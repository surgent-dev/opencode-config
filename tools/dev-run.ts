import { tool } from '@opencode-ai/plugin'
import { $ } from 'bun'

interface SurgentConfig {
  name: string
  scripts: {
    dev: string | string[]
    lint?: string
    'dev:convex'?: string
  }
}

async function getSurgentConfig(): Promise<SurgentConfig> {
  const cfg = await Bun.file('surgent.json')
    .json()
    .catch(() => null)
  if (!cfg?.name) throw new Error('Missing "name" in surgent.json')
  if (!cfg?.scripts?.dev) throw new Error('Missing "scripts.dev" in surgent.json')
  return cfg as SurgentConfig
}

async function isPm2Online(name: string) {
  const list = await $`pm2 jlist`.json().catch(() => [])
  return list.some((p: any) => p?.name === name && p?.pm2_env?.status === 'online')
}

export default tool({
  description:
    'Ensures the development server is running. Syncs Convex if needed and runs lint. Args: syncConvex (default false) - set to true after Convex schema/function changes.',
  args: { syncConvex: tool.schema.boolean().default(false) },
  async execute({ syncConvex }): Promise<string> {
    const cfg = await getSurgentConfig()
    const steps: string[] = []

    // Sync Convex if requested and script exists
    if (syncConvex && cfg.scripts['dev:convex']) {
      await $`${{ raw: cfg.scripts['dev:convex'] }}`
      steps.push('Synced Convex')
    }

    // Run lint if script exists
    if (cfg.scripts.lint) {
      await $`${{ raw: cfg.scripts.lint }}`
      steps.push('Ran lint')
    }

    // Start dev server(s) via PM2
    const commands = Array.isArray(cfg.scripts.dev) ? cfg.scripts.dev : [cfg.scripts.dev]
    for (let i = 0; i < commands.length; i++) {
      const name = commands.length > 1 ? `${cfg.name}:${i + 1}` : cfg.name
      if (await isPm2Online(name)) {
        steps.push(`${name} already online`)
      } else {
        await $`${{ raw: `pm2 start "${commands[i]}" --name ${name}` }}`
        steps.push(`Started ${name}`)
      }
    }

    return steps.join('\n')
  },
})
