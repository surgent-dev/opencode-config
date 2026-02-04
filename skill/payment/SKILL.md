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
bun add @surgent/pay-convex
```

## Backend
File: `convex/pay.ts`

```ts
import { Surpay } from "@surgent/pay-convex"

const pay = new Surpay({
  apiKey: process.env.SURGENT_API_KEY!,
  identify: async (ctx) => {
    // IMPORTANT: Use ctx.auth.getUserIdentity() - works in actions!
    // Do NOT use ctx.db (actions don't have database access)
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null
    return {
      customerId: identity.subject,
      customerData: {
        name: identity.name,
        email: identity.email,
      },
    }
  },
})

export const {
  createCheckout,
  guestCheckout,
  check,
  listProducts,
  getCustomer,
  listSubscriptions,
} = pay.api()
```

## Frontend Usage

### Authenticated Checkout
```tsx
import { useAction } from "convex/react"
import { api } from "../convex/_generated/api"
import { toast } from "sonner"

export function CheckoutButton({ productSlug }: { productSlug: string }) {
  const createCheckout = useAction(api.pay.createCheckout)

  const handleCheckout = async () => {
    const { data, error } = await createCheckout({
      productSlug, // or productId: "prod_123"
      successUrl: window.location.origin + "/success",
      cancelUrl: window.location.origin + "/cancel",
    })
    if (error) {
      toast.error(error.message)
      return
    }
    if (data?.checkoutUrl) {
      window.location.href = data.checkoutUrl
    } else {
      toast.error("Failed to create checkout")
    }
  }

  return <button onClick={handleCheckout}>Subscribe</button>
}
```

### Guest Checkout (Anonymous Users)
For checkout without requiring sign-in:

```tsx
import { useAction } from "convex/react"
import { api } from "../convex/_generated/api"
import { toast } from "sonner"

// Get or create persistent guest ID
function getGuestId(): string {
  const key = "surgent_guest_id"
  let id = localStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(key, id)
  }
  return id
}

export function GuestCheckoutButton({ productSlug }: { productSlug: string }) {
  const guestCheckout = useAction(api.pay.guestCheckout)

  const handleCheckout = async () => {
    const { data, error } = await guestCheckout({
      productSlug,
      customerId: getGuestId(),
      customerName: "Guest", // optional
      successUrl: window.location.origin + "/success",
      cancelUrl: window.location.origin + "/cancel",
    })
    if (error) {
      toast.error(error.message)
      return
    }
    if (data?.checkoutUrl) {
      window.location.href = data.checkoutUrl
    } else {
      toast.error("Failed to create checkout")
    }
  }

  return <button onClick={handleCheckout}>Buy Now</button>
}
```

### Check Access
```tsx
const check = useAction(api.pay.check)

const hasAccess = async (productSlug: string) => {
  const { data, error } = await check({ productSlug })
  if (error) return false
  return data.allowed
}
```

### List Products
```tsx
const listProducts = useAction(api.pay.listProducts)

const products = await listProducts({})
// products.data = [{ product: { id, name, slug }, prices: [...] }, ...]
```

## Products & Price Information
Products and prices can be queried from the pay MCP server using `list_products` tool, or via `listProducts` action in frontend.

## Important Notes

### Response Shape (CRITICAL)
All Surpay actions return `{ data, error }`. **NEVER** treat the response as a URL directly.

```tsx
// ✅ CORRECT
const { data, error } = await guestCheckout({...})
if (error) {
  toast.error(error.message)
  return
}
if (data?.checkoutUrl) {
  window.location.href = data.checkoutUrl
}

// ❌ WRONG - will cause [object Object] redirect
const result = await guestCheckout({...})
window.location.href = result // BROKEN!
window.location.href = result.url // BROKEN! (it's checkoutUrl, not url)
```

### identify() Function
The `identify()` function runs in a Convex **action** context:
- ✅ `ctx.auth.getUserIdentity()` - **use this!**
- ✅ `ctx.runQuery()` / `ctx.runMutation()`
- ❌ `ctx.db` - **NOT available in actions!**

### Product ID vs Slug
All product-related actions accept either `productId` or `productSlug`:
```typescript
// By slug (human-readable) - RECOMMENDED
await createCheckout({ productSlug: "pro-plan" })

// By ID
await createCheckout({ productId: "prod_abc123" })
```

## Checklist
- [ ] `SURGENT_API_KEY` set in Convex dashboard (SHOULD BE DONE AFTER CONVEX SETUP)
- [ ] `convex/pay.ts` created with `ctx.auth.getUserIdentity()` pattern
- [ ] Actions exported and accessible via `api.pay`
- [ ] Run `dev-run` with `syncConvex: true` to push changes
