---
name: surgent-payment
description: Payment integration via Surpay. Use after Convex and auth setup.
---

## Prerequisites

- Convex project initialized (`convex_create_project` called)
- `SURGENT_API_KEY` set in Convex (auto-configured by setup)

## Setup

```bash
bun add @surgent/pay-convex
```

**convex/pay.ts**
```ts
import { Surpay } from "@surgent/pay-convex"

const pay = new Surpay({
  apiKey: process.env.SURGENT_API_KEY!,
  identify: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null
    return {
      customerId: identity.subject,
      customerData: { name: identity.name, email: identity.email },
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

All actions return `{ data, error }`. Open checkout in new tab (iframe blocks payment providers).

```tsx
import { useAction } from "convex/react"
import { api } from "../convex/_generated/api"
import { toast } from "sonner"

const checkout = useAction(api.pay.createCheckout) // or guestCheckout

const handleCheckout = async () => {
  const { data, error } = await checkout({
    productSlug: "pro-plan",
    successUrl: window.location.origin + "/success",
    cancelUrl: window.location.origin + "/cancel",
  })

  if (error) return toast.error(error.message)
  if (!data?.checkoutUrl) return toast.error("Checkout failed")

  // New tab to avoid iframe X-Frame-Options block
  const win = window.open(data.checkoutUrl, "_blank", "noopener,noreferrer")
  if (!win) window.location.href = data.checkoutUrl // popup blocked fallback
}
```

**Guest checkout** — add `customerId` (use localStorage UUID):
```tsx
const { data, error } = await guestCheckout({
  productSlug: "pro-plan",
  customerId: localStorage.getItem("guest_id") || crypto.randomUUID(),
  successUrl: "...",
  cancelUrl: "...",
})
```

**Check access:**
```tsx
const { data, error } = await check({ productSlug: "pro-plan" })
const hasAccess = !error && data?.allowed
```

## Common Mistakes

```tsx
// WRONG: response is { data, error }, not a URL
window.location.href = await checkout({...})

// WRONG: field is checkoutUrl, not url
window.location.href = data.url

// WRONG: direct redirect fails in iframe
window.location.href = data.checkoutUrl
```

## Notes

- `identify()` runs in action context: use `ctx.auth.getUserIdentity()`, not `ctx.db`
- Use `productSlug` (readable) over `productId`
- Query products via `listProducts` action or `list_products` MCP tool
