---
name: convex-auth
description: Use only after convex has been setup, this setup a minimal auth using convex backend.
---

## Prerequisites
- Convex MCP must be available and project must have Convex initialized (`convex/` folder exists)
- If not, run the convex setup skill first

## Quick Setup

1. Install dependencies (pin @auth/core):
```bash
npm install @convex-dev/auth @auth/core@0.37.0
```

2. Run the automated setup wizard (generates keys and sets env vars):
```bash
npx @convex-dev/auth
```

3. Update `convex/tsconfig.json`:
```json
{
  "compilerOptions": {
    "skipLibCheck": true,
    "moduleResolution": "Bundler"
  }
}
```

## Backend Files

### 1. `convex/auth.config.ts`
```ts
export default {
  providers: [],
};
```

### 2. `convex/schema.ts`
```ts
import { defineSchema } from "convex/server";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,
});
```

### 3. `convex/auth.ts`
```ts
import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password],
});
```

### 4. `convex/http.ts`
```ts
import { httpRouter } from "convex/server";
import { auth } from "./auth";

const http = httpRouter();
auth.addHttpRoutes(http);
export default http;
```

## Frontend Setup

### 1. `src/main.tsx`
```tsx
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import ReactDOM from "react-dom/client";
import { App } from "./App";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <ConvexAuthProvider client={convex}>
    <App />
  </ConvexAuthProvider>
);
```

### 2. `src/AuthForm.tsx`
```tsx
import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";

export function AuthForm() {
  const { signIn } = useAuthActions();
  const [step, setStep] = useState<"signIn" | "signUp">("signIn");

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      void signIn("password", formData);
    }}>
      <input name="email" placeholder="Email" type="email" required />
      <input name="password" placeholder="Password" type="password" />
      <input name="flow" type="hidden" value={step} />
      <button type="submit">{step === "signIn" ? "Sign In" : "Sign Up"}</button>
      <button type="button" onClick={() => setStep(step === "signIn" ? "signUp" : "signIn")}>
        {step === "signIn" ? "Need an account?" : "Already have an account?"}
      </button>
    </form>
  );
}
```

## Using Auth in Functions
Use `getAuthUserId` from `@convex-dev/auth/server` instead of `ctx.auth.getUserIdentity()`.

```ts
import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getMe = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not authenticated");
    }
    return await ctx.db.get(userId);
  },
});
```

## Checklist
- [ ] `@auth/core` is pinned to `0.37.0`
- [ ] `npx @convex-dev/auth` has been run (keys generated)
- [ ] `convex/tsconfig.json` has `skipLibCheck: true` and `moduleResolution: "Bundler"`
- [ ] `convex/http.ts` exports the router with `auth.addHttpRoutes(http)`
- [ ] Backend functions use `getAuthUserId(ctx)`
- [ ] Frontend uses `ConvexAuthProvider`
