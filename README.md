# Surgent Opencode Config

A delegator pattern for OpenCode. One orchestrator plans and delegates; specialized subagents execute. Think head chef directing line cooks.

## Why?

Small contexts minimize hallucinations and ensure focus. Delegation leverages task-specific models, optimizes token costs, and enables parallel execution.

## Agents

NOTE: These models are subject to change, feel free to pick what works for you.

| Agent | Model | Role |
| :--- | :--- | :--- |
| **@orchestrator** | `claude-opus-4-5` | Plans, coordinates, delegates |
| **@coder** | `gpt-5.2-codex` | Backend logic, algorithms, APIs |
| **@frontend** | `gemini-3-pro-preview` | UI components, styling |
| **@reviewer** | `gpt-5.2` | Code review, security, best practices |
| **@explorer** | `gpt-5.2` | Codebase search, context gathering |
| **@research** | `glm-4.7-free` | Web research, external docs |
| **@writer** | `gemini-3-flash-preview` | Documentation |

## How It Works

1. **Plan**: Orchestrator breaks the task into subtasks
2. **Delegate**: Tasks go to specialists via the `task` tool
3. **Execute**: Subagents do the work
4. **Deliver**: Orchestrator reviews and presents results

## Installation

```bash
./install.sh
```

Copies configs from `agent/` to `~/.config/opencode/agent/` and merges `opencode.json`.

## Usage

The orchestrator delegates automatically. You can also call agents directly:

```
@coder Implement JWT validation middleware
@frontend Create a responsive Navbar with Tailwind
@reviewer Review src/auth/ for security issues
@explorer Find all usages of useAuth hook
@research Find Stripe API docs for payment intents
@writer Document the API endpoints
```

## Customization

Edit files in `agent/`:
- **Model**: Change the `model` field in frontmatter
- **Tools**: Toggle tool access in the `tools` section
- **New agents**: Add a `.md` file and update orchestrator instructions

## License

MIT
