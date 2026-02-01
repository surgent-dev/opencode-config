---
name: convex-auth
description: Setup email/password auth using Convex. Run after Convex project is created.
---

## Prerequisites

- Convex project must be created first (`convex_create_project`)
- Auth keys (SITE_URL, JWT_PRIVATE_KEY, JWKS) are auto-configured at project creation

## Setup Steps

### 1. Install packages
```bash
bun add @convex-dev/auth @auth/core@0.37.0
```

### 2. Update convex/tsconfig.json
Ensure these compiler options are set:
```json
{
  "compilerOptions": {
    "moduleResolution": "Bundler",
    "skipLibCheck": true
  }
}
```

### 3. Create convex/auth.config.ts
```ts
export default {
  providers: [],
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
```tsx
import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";

export function AuthForm() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      signIn("password", formData);
    }}>
      <input name="email" type="email" placeholder="Email" required />
      <input name="password" type="password" placeholder="Password" required />
      <input name="flow" type="hidden" value={flow} />
      <button type="submit">{flow === "signIn" ? "Sign In" : "Sign Up"}</button>
      <button type="button" onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}>
        {flow === "signIn" ? "Need an account?" : "Have an account?"}
      </button>
    </form>
  );
}
```

## In Convex Functions
```ts
import { getAuthUserId } from "@convex-dev/auth/server";

const userId = await getAuthUserId(ctx);
if (!userId) throw new Error("Not authenticated");
```

## Checklist
- [ ] `bun add @convex-dev/auth @auth/core@0.37.0`
- [ ] `convex/tsconfig.json` updated (moduleResolution, skipLibCheck)
- [ ] `convex/auth.config.ts` created
- [ ] `convex/auth.ts` created with Password provider
- [ ] `convex/http.ts` created
- [ ] `...authTables` spread in schema
- [ ] Frontend wrapped with `ConvexAuthProvider`
- [ ] Run `dev-run` with `syncConvex: true` to push changes
