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
  const cfg = await Bun.file('surgent.json').json().catch(() => null)
  if (!cfg?.name) throw new Error('Missing "name" in surgent.json')
  if (!cfg?.scripts?.dev) throw new Error('Missing "scripts.dev" in surgent.json')
  return cfg as SurgentConfig
}

async function isPm2Online(name: string): Promise<boolean> {
  try {
    const list = await $`pm2 jlist`.json()
    return list.some((p: any) => p?.name === name && p?.pm2_env?.status === 'online')
  } catch {
    return false
  }
}

export default tool({
  description:
    'Start dev server and run lint. Use syncConvex: true after Convex schema/function changes.',
  args: { syncConvex: tool.schema.boolean().default(false) },
  async execute({ syncConvex }): Promise<string> {
    const cfg = await getSurgentConfig()
    const steps: string[] = []

    // Sync Convex if requested
    if (syncConvex && cfg.scripts['dev:convex']) {
      try {
        await $`${{ raw: cfg.scripts['dev:convex'] }}`.quiet()
        steps.push('✓ Synced Convex')
      } catch (err: any) {
        return `Convex sync failed:\n${err.stderr?.toString() || err.message}`
      }
    }

    // Run lint
    if (cfg.scripts.lint) {
      try {
        await $`${{ raw: cfg.scripts.lint }}`.quiet()
        steps.push('✓ Lint passed')
      } catch (err: any) {
        const output = err.stderr?.toString() || err.stdout?.toString() || err.message
        return `Lint failed:\n${output}`
      }
    }

    // Start dev server(s) via PM2
    const commands = Array.isArray(cfg.scripts.dev) ? cfg.scripts.dev : [cfg.scripts.dev]
    for (let i = 0; i < commands.length; i++) {
      const name = commands.length > 1 ? `${cfg.name}:${i + 1}` : cfg.name
      if (await isPm2Online(name)) {
        steps.push(`✓ ${name} already online`)
      } else {
        try {
          await $`pm2 start ${commands[i]} --name ${name}`.quiet()
          steps.push(`✓ Started ${name}`)
        } catch (err: any) {
          steps.push(`✗ Failed to start ${name}: ${err.message}`)
        }
      }
    }

    return steps.join('\n')
  },
})
