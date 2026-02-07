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
  const { exitCode, stdout } = await $`pm2 jlist`.nothrow().quiet()
  if (exitCode !== 0) return false
  try {
    const list = JSON.parse(stdout.toString())
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
    const output: string[] = []

    // Sync Convex if requested
    if (syncConvex && cfg.scripts['dev:convex']) {
      const result = await $`${{ raw: cfg.scripts['dev:convex'] }}`.nothrow().quiet()
      if (result.exitCode !== 0) {
        output.push('CONVEX SYNC FAILED:')
        output.push(result.stdout.toString())
        output.push(result.stderr.toString())
        return output.join('\n')
      }
      // Verify _generated/ was actually created
      const apiFile = Bun.file('convex/_generated/api.js')
      if (await apiFile.exists()) {
        output.push('✓ Convex synced (convex/_generated/api.js verified)')
      } else {
        output.push('⚠ Convex sync ran but convex/_generated/api.js not found — imports will fail')
      }
    }

    // Run lint
    if (cfg.scripts.lint) {
      const result = await $`${{ raw: cfg.scripts.lint }}`.nothrow().quiet()
      if (result.exitCode !== 0) {
        output.push('LINT FAILED:')
        output.push(result.stdout.toString())
        output.push(result.stderr.toString())
        return output.join('\n')
      }
      output.push('✓ Lint passed')
    }

    // Start dev server(s) via PM2
    const commands = Array.isArray(cfg.scripts.dev) ? cfg.scripts.dev : [cfg.scripts.dev]
    for (let i = 0; i < commands.length; i++) {
      const name = commands.length > 1 ? `${cfg.name}:${i + 1}` : cfg.name
      if (await isPm2Online(name)) {
        // Flush stale logs before restart so dev-logs only shows fresh output
        await $`pm2 flush ${name}`.nothrow().quiet()
        await $`pm2 restart ${name}`.nothrow().quiet()
        output.push(`✓ ${name} restarted (logs flushed)`)
      } else {
        const result = await $`pm2 start ${commands[i]} --name ${name}`.nothrow().quiet()
        if (result.exitCode !== 0) {
          output.push(`✗ Failed to start ${name}:`)
          output.push(result.stderr.toString())
        } else {
          output.push(`✓ Started ${name}`)
        }
      }
    }

    return output.join('\n')
  },
})
