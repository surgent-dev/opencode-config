---
name: surgent-payment
description: Payment integration via Surpay. Requires Convex. Auth optional (use guestCheckout without).
---

## Prerequisites

- Convex project initialized (`convex_create_project` called)
- `SURGENT_API_KEY` set in Convex (auto-configured by setup)
- ConvexProvider in main.tsx (see `skill/convex/SKILL.md` for setup)

## Install

```bash
bun add @surgent/pay-convex
```

## Backend

Create `convex/pay.ts`:

```ts
import { Surpay } from "@surgent/pay-convex"

const pay = new Surpay({
  apiKey: process.env.SURGENT_API_KEY!,
  identify: async (ctx) => {
    // Use ctx.auth in actions, not ctx.db
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

## Frontend

### Response Shape

All Surpay actions return `{ data, error }`. Never treat the response as a URL directly.

```tsx
// Correct
const { data, error } = await checkout({...})
if (error) return toast.error(error.message)
if (data?.checkoutUrl) { ... }

// Wrong - causes [object Object] redirect
const result = await checkout({...})
window.location.href = result
window.location.href = result.url  // field is checkoutUrl, not url
```

### Checkout Redirect

Always open checkout URLs in a new tab. Surgent preview runs in an iframe, and payment providers block iframe embedding via X-Frame-Options.

```tsx
// Correct - new tab avoids iframe issues
const win = window.open(data.checkoutUrl, "_blank", "noopener,noreferrer")
if (!win) window.location.href = data.checkoutUrl  // popup blocked fallback

// Wrong - fails in iframe context
window.location.href = data.checkoutUrl
```

### Authenticated Checkout

```tsx
import { useAction } from "convex/react"
import { api } from "convex/_generated/api"
import { toast } from "sonner"

export function CheckoutButton({ productSlug }: { productSlug: string }) {
  const createCheckout = useAction(api.pay.createCheckout)

  const handleCheckout = async () => {
    const { data, error } = await createCheckout({
      productSlug,
      successUrl: window.location.origin + "/success",
      cancelUrl: window.location.origin + "/cancel",
    })

    if (error) return toast.error(error.message)
    if (!data?.checkoutUrl) return toast.error("Checkout failed")

    const win = window.open(data.checkoutUrl, "_blank", "noopener,noreferrer")
    if (!win) window.location.href = data.checkoutUrl
  }

  return <button onClick={handleCheckout}>Subscribe</button>
}
```

### Guest Checkout

For checkout without requiring sign-in:

```tsx
import { useAction } from "convex/react"
import { api } from "convex/_generated/api"
import { toast } from "sonner"

function getGuestId(): string {
  const key = "guest_id"
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
      customerName: "Supporter",
      successUrl: window.location.origin + "/success",
      cancelUrl: window.location.origin + "/cancel",
    })

    if (error) return toast.error(error.message)
    if (!data?.checkoutUrl) return toast.error("Checkout failed")

    const win = window.open(data.checkoutUrl, "_blank", "noopener,noreferrer")
    if (!win) window.location.href = data.checkoutUrl
  }

  return <button onClick={handleCheckout}>Buy Now</button>
}
```

### Check Access

```tsx
const check = useAction(api.pay.check)

const hasAccess = async (productSlug: string): Promise<boolean> => {
  const { data, error } = await check({ productSlug })
  if (error) return false
  return data?.allowed ?? false
}
```

### List Products

```tsx
const listProducts = useAction(api.pay.listProducts)

const products = await listProducts({})
// products.data = [{ product: { id, name, slug }, prices: [...] }, ...]
```

## Notes

**identify() context**: Runs in a Convex action. Use `ctx.auth.getUserIdentity()` or `ctx.runQuery()`. Do not use `ctx.db` (not available in actions).

**Product identifiers**: All actions accept `productSlug` or `productId`. Prefer slug for readability.

```ts
await createCheckout({ productSlug: "pro-plan" })
await createCheckout({ productId: "prod_abc123" })
```

**Products & prices**: Query via `listProducts` action or `list_products` MCP tool.

## Checklist

- [ ] `SURGENT_API_KEY` set in Convex
- [ ] `convex/pay.ts` created with identify pattern
- [ ] Run `dev-run` with `syncConvex: true` to push changes and generate `convex/_generated/`
- [ ] **Wait for sync to complete** before frontend work — frontend imports require `_generated/api.ts`
