---
name: convex-auth
description: Setup email/password auth using Convex. Run after Convex project is created.
---

## Prerequisites

- Convex project must be created first (`convex_create_project`)
- Auth keys (SITE_URL, JWT_PRIVATE_KEY, JWKS) are auto-configured at project creation
- For Convex patterns (queries, mutations, schema), see `skill/convex/SKILL.md`

## Setup Steps

### 1. Install packages
```bash
bun add @convex-dev/auth @auth/core@0.37.0
```

### 2. Update convex/tsconfig.json
Use this full config (required for @convex-dev/auth):
```json
{
  /* This TypeScript project config describes the environment that
   * Convex functions run in and is used to typecheck them.
   * You can modify it, but some settings required to use Convex.
   */
  "compilerOptions": {
    /* These settings are not required by Convex and can be modified. */
    "allowJs": true,
    "strict": true,
    "jsx": "react-jsx",
    "allowSyntheticDefaultImports": true,

    /* Required for @convex-dev/auth */
    "moduleResolution": "Bundler",
    "skipLibCheck": true,

    /* These compiler options are required by Convex */
    "target": "ESNext",
    "lib": ["ES2021", "dom"],
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "isolatedModules": true,
    "noEmit": true
  },
  "include": ["./**/*"],
  "exclude": ["./_generated"]
}
```

**Auth-specific requirements:**
- `moduleResolution: "Bundler"` - Required for @convex-dev/auth imports
- `skipLibCheck: true` - Avoids type conflicts with auth libraries

### 3. Create convex/auth.config.ts
```ts
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};
```

### 4. Create convex/auth.ts
```ts
import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password],
});
```

### 5. Create convex/http.ts
```ts
import { httpRouter } from "convex/server";
import { auth } from "./auth";

const http = httpRouter();

auth.addHttpRoutes(http);

export default http;
```

### 6. Update convex/schema.ts - add authTables
```ts
import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,
  // your tables here
});
```

### 7. Frontend - wrap with provider
```tsx
// src/main.tsx or app entry
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <ConvexAuthProvider client={convex}>
    <App />
  </ConvexAuthProvider>
);
```

## Auth Form Example

**Important:** Use a plain object (not FormData) to avoid `InvalidAccountId` errors.

```tsx
import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { toast } from "sonner";

export function AuthForm() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signIn("password", {
        email,
        password,
        flow,
        ...(flow === "signUp" ? { name } : {}),
      });
    } catch (error) {
      const message = String(error);
      if (message.includes("InvalidAccountId") || message.includes("InvalidSecret")) {
        toast.error("Invalid email or password");
      } else if (message.includes("TooManyFailedAttempts")) {
        toast.error("Too many attempts, try again later");
      } else {
        toast.error("Authentication failed");
      }
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {flow === "signUp" && (
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" required />
      )}
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required />
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required />
      <button type="submit">{flow === "signIn" ? "Sign In" : "Sign Up"}</button>
      <button type="button" onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}>
        {flow === "signIn" ? "Need an account?" : "Have an account?"}
      </button>
    </form>
  );
}
```

**Common errors (map to friendly messages):**
- `InvalidAccountId` — account doesn't exist → "Invalid email or password"
- `InvalidSecret` — wrong password → "Invalid email or password"
- `TooManyFailedAttempts` — rate limited → "Too many attempts, try again later"

## In Convex Functions
```ts
import { getAuthUserId } from "@convex-dev/auth/server";

const userId = await getAuthUserId(ctx);
if (!userId) throw new Error("Not authenticated");
```

## Convex Folder Structure (with Auth)

```
convex/
├── _generated/          # Auto-generated (don't edit)
│   ├── api.ts
│   ├── dataModel.ts
│   └── server.ts
├── tsconfig.json        # Convex-specific TS config
├── schema.ts            # Database schema with ...authTables
├── auth.config.ts       # Auth provider config
├── auth.ts              # Auth setup (signIn, signOut, etc.)
├── http.ts              # HTTP routes (auth routes added here)
└── [your-files].ts      # Your queries, mutations, actions
```

**File naming:**
- Use kebab-case for files: `user-profiles.ts`, `chat-messages.ts`
- Group related functions in single files
- Use `internal` prefix for private functions

## Checklist
- [ ] `bun add @convex-dev/auth @auth/core@0.37.0`
- [ ] `convex/tsconfig.json` updated (full config with moduleResolution, skipLibCheck)
- [ ] `convex/auth.config.ts` created
- [ ] `convex/auth.ts` created with Password provider
- [ ] `convex/http.ts` created with auth routes
- [ ] `convex/schema.ts` has `...authTables` spread
- [ ] Run `dev-run` with `syncConvex: true` — generates `convex/_generated/` needed for frontend imports
- [ ] **Wait for sync** before frontend work
- [ ] Frontend wrapped with `ConvexAuthProvider`
