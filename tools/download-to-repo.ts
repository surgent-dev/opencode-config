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

    const result = await $`curl -L --create-dirs -o ${path.join(process.cwd(), targetPath)} ${sourceUrl}`.nothrow().quiet()
    if (result.exitCode !== 0) {
      return `Download failed:\n${result.stderr.toString()}`
    }
    return `✓ Downloaded to ${targetPath}`
  },
})
