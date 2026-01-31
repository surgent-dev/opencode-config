---
name: convex-auth
description: Setup email/password auth using Convex. Run after Convex is initialized.
---

## Setup

```bash
bun add @convex-dev/auth @auth/core@0.37.0
npx @convex-dev/auth
```

The wizard automatically:
- Sets env vars (`SITE_URL`, `JWT_PRIVATE_KEY`, `JWKS`)
- Updates `convex/tsconfig.json`
- Creates `convex/auth.config.ts`, `convex/auth.ts`, `convex/http.ts`

## After Wizard

### 1. Schema - add authTables
```ts
// convex/schema.ts
import { defineSchema } from "convex/server";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,
  // your tables here
});
```

### 2. Auth - add Password provider
```ts
// convex/auth.ts
import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [Password],
});
```

### 3. Frontend - wrap with provider
```tsx
// src/main.tsx
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <ConvexAuthProvider client={convex}>
    <App />
  </ConvexAuthProvider>
);
```

### 4. Auth Form
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
- [ ] `@auth/core` pinned to `0.37.0`
- [ ] `npx @convex-dev/auth` ran
- [ ] `...authTables` in schema
- [ ] Password provider added
- [ ] Frontend wrapped with `ConvexAuthProvider`
