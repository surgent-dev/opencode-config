import { tool } from '@opencode-ai/plugin'
import { $ } from 'bun'
import path from 'path'

export default tool({
  description:
    'Download a file from URL to project. targetPath is relative (e.g. "public/logo.png")',
  args: {
    sourceUrl: tool.schema.string(),
    targetPath: tool.schema.string(),
  },
  async execute({ sourceUrl, targetPath }): Promise<string> {
    if (!sourceUrl?.trim()) return 'Missing sourceUrl'
    if (!targetPath?.trim()) return 'Missing targetPath'
    if (path.isAbsolute(targetPath)) return 'targetPath must be relative'

    try {
      await $`curl -L --create-dirs -o ${path.join(process.cwd(), targetPath)} ${sourceUrl}`.quiet()
      return `✓ Downloaded to ${targetPath}`
    } catch (err: any) {
      return `Failed to download: ${err.stderr?.toString() || err.message}`
    }
  },
})
