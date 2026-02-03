import { tool } from '@opencode-ai/plugin'
import { $ } from 'bun'

export default tool({
  description:
    'Fetch recent Convex function logs. Shows errors by default, use success=true to include successful calls.',
  args: {
    lines: tool.schema.number().default(50).describe('Number of recent logs to fetch'),
    success: tool.schema.boolean().default(false).describe('Include successful function logs'),
  },
  async execute({ lines, success }): Promise<string> {
    const flags = ['--history', String(lines)]
    if (success) flags.push('--success')

    const result = await $`timeout 3 bunx convex logs ${flags}`.nothrow().quiet()

    if (result.exitCode !== 0) {
      const fallback = `timeout 3 bunx convex logs --history ${lines}${success ? ' --success' : ''}`
      return `Tool failed. Run manually: ${fallback}`
    }

    const output = result.stdout.toString().trim()
    if (!output) {
      return success ? 'No logs found' : 'No errors found (use success=true to see all logs)'
    }
    return output
  },
})
