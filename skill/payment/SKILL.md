---
name: surgent-payment
description: This enables payment setup for the project, use after convex setup and convex auth setup.
---

## Prerequisites
- Convex MCP must be available and project initialized (`convex/` folder exists), CONVEX MUST BE SETUP (create_project must be called on convex MCP)
- convex-auth skill must be completed (auth working)
- If not, use the convex-auth skill
- `SURGENT_API_KEY` environment variable must be set in Convex, this should be done by the convex setup.

## Install
```bash
npm install @surgent-dev/surpay-convex
```

## Backend
File: `convex/surpay.ts`

```ts
import { Surpay } from "@surgent-dev/surpay-convex"
import { getAuthUserId } from "@convex-dev/auth/server"

const surpay = new Surpay({
  apiKey: process.env.SURGENT_API_KEY!,
  identify: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null
    const user = await ctx.db.get(userId)
    return {
      customerId: userId,
      customerData: {
        name: user?.name,
        email: user?.email,
      },
    }
  },
})

export const {
  createCheckout,
  check,
  getCustomer,
  listSubscriptions,
} = surpay.api()
```

## Frontend Usage
```tsx
import { useAction } from "convex/react"
import { api } from "../convex/_generated/api"

export function CheckoutButton({ productId }: { productId: string }) {
  const createCheckout = useAction(api.surpay.createCheckout)

  const handleCheckout = async () => {
    const { data, error } = await createCheckout({
      product_id: productId,
      success_url: window.location.origin,
      cancel_url: window.location.origin,
    })
    if (data?.checkout_url) window.location.href = data.checkout_url
    if (error) console.error(error.message)
  }

  return <button onClick={handleCheckout}>Subscribe</button>
}
```

## Products & Price information
Products and prices can be queried from the pay mcp server.

## Checklist
- [ ] `SURGENT_API_KEY` set in Convex dashboard (SHOULD BE DONE AFTER CONVEX SETUP)
- [ ] `convex/surpay.ts` created with `getAuthUserId`
- [ ] Actions exported and accessible via `api.surpay`
