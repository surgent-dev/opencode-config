import { tool } from '@opencode-ai/plugin'
import { $ } from 'bun'

export default tool({
  description: 'Show dev server PM2 logs. Args: lines (default 20)',
  args: { lines: tool.schema.number().default(20) },
  async execute({ lines }): Promise<string> {
    const cfg = await Bun.file('surgent.json').json().catch(() => null)
    if (!cfg?.name) return 'Missing "name" in surgent.json'

    const result = await $`pm2 logs ${cfg.name} --lines ${lines} --nostream`.nothrow().quiet()
    if (result.exitCode !== 0) {
      return `Failed to get logs:\n${result.stderr.toString()}`
    }
    return result.stdout.toString()
  },
})
