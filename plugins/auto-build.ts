import type { Hooks, PluginInput } from "@opencode-ai/plugin"

export default async (input: PluginInput): Promise<Hooks> => {
  let building = false

  return {
    event: async ({ event }) => {
      if (
        event.type === "session.status" &&
        (event.properties as any).status?.type === "idle" &&
        !building
      ) {
        building = true
        try {
          await input.$`bun run build`
          console.log("[auto-build] build complete")
        } catch (err) {
          console.error("[auto-build] build failed:", err)
        } finally {
          building = false
        }
      }
    },
  }
}
