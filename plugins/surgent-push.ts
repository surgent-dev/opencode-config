import type { Event } from '@opencode-ai/sdk'
import type { Plugin } from '@opencode-ai/plugin'

type Write =
  | { entity: 'session'; id: string; payload: unknown }
  | { entity: 'message'; id: string; session_id: string; payload: unknown }
  | { entity: 'part'; id: string; session_id: string; message_id: string; payload: unknown }
  | { entity: 'todo'; id: string; payload: unknown }
  | { entity: 'session_diff'; id: string; payload: unknown }

type Drop =
  | { entity: 'session'; id: string }
  | { entity: 'message'; id: string }
  | { entity: 'part'; id: string }

type State = {
  dirty: boolean
  drop: Map<string, Drop>
  timer?: ReturnType<typeof setTimeout>
  run?: Promise<void>
}

const delay = 2000
const limit = 100
const bytes = 512 * 1024

const plugin: Plugin = async (input) => {
  const base = Bun.env.SURGENT_BASE_URL
  const key = Bun.env.SURGENT_API_KEY
  if (!base || !key) return {}

  const serverUrl = input.serverUrl?.href ?? 'http://localhost:4096'
  const state = new Map<string, State>()
  const log = (message: string, extra?: Record<string, unknown>) =>
    input.client.app
      .log({
        body: {
          service: 'surgent-push',
          level: 'error',
          message,
          extra,
        },
      })
      .catch(() => {})

  const post = async (url: string, body: unknown) => {
    const res = await fetch(new URL(url, base), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
      },
      body: JSON.stringify(body),
    })
    if (res.ok) return true
    const text = await res.text().catch(() => '')
    const err = text || `${res.status} ${res.statusText}`
    if (res.status === 429 || res.status >= 500) throw new Error(err)
    await log(err)
    return false
  }

  async function localGet(path: string) {
    const res = await fetch(new URL(path, serverUrl))
    if (!res.ok) throw new Error(`${res.status} ${path}`)
    return res.json()
  }

  const load = (id: string) => {
    const prev = state.get(id)
    if (prev) return prev

    const next: State = {
      dirty: false,
      drop: new Map(),
    }
    state.set(id, next)
    return next
  }

  const clear = (id: string) => {
    const item = state.get(id)
    if (!item?.timer) return
    clearTimeout(item.timer)
    item.timer = undefined
  }

  const prune = (id: string) => {
    const item = state.get(id)
    if (!item) return
    if (item.dirty) return
    if (item.drop.size) return
    if (item.timer) return
    if (item.run) return
    state.delete(id)
  }

  const plan = (id: string, ms = delay) => {
    const item = load(id)
    if (item.run) return
    clear(id)
    item.timer = setTimeout(() => {
      void flush(id)
    }, ms)
  }

  const mark = (id: string) => {
    load(id).dirty = true
    plan(id)
  }

  const drop = (id: string, op: Drop) => {
    const item = load(id)
    if (op.entity === 'session') {
      item.dirty = false
      item.drop.clear()
      item.drop.set(`session:${op.id}`, op)
      clear(id)
      plan(id, 0)
      return
    }

    item.drop.set(`${op.entity}:${op.id}`, op)
    plan(id)
  }

  const push = async (id: string) => {
    const [session, messages, todos, diff] = await Promise.all([
      localGet(`/session/${id}`) as Promise<any>,
      localGet(`/session/${id}/message`).then((d: any) => d ?? []).catch(() => []),
      localGet(`/session/${id}/todo`).then((d: any) => d ?? []).catch(() => []),
      localGet(`/session/${id}/diff`).then((d: any) => d ?? []).catch(() => []),
    ])
    if (!session) throw new Error(`Missing session ${id}`)

    const part = (item: any) => {
      if (item.type !== 'file') return item
      if (!item.url?.startsWith('data:')) return item
      return { ...item, url: 'data:,' }
    }

    const raw: Write[] = [
      { entity: 'session', id: session.id, payload: session },
      ...(Array.isArray(messages) ? messages : []).flatMap((item: any) => [
        { entity: 'message' as const, id: item.info.id, session_id: id, payload: item.info },
        ...(item.parts ?? []).map((value: any) => {
          const p = part(value)
          return {
            entity: 'part' as const,
            id: p.id,
            session_id: id,
            message_id: p.messageID,
            payload: p,
          }
        }),
      ]),
      { entity: 'todo', id, payload: todos },
      { entity: 'session_diff', id, payload: JSON.stringify(diff).length > bytes ? [] : diff },
    ]

    const bad = raw.filter((item) => JSON.stringify(item.payload).length > bytes)
    if (bad.some((item) => item.entity !== 'session_diff')) {
      await log(`oversized sync payload for ${id}`)
      return false
    }

    const ops = raw.filter((item) => JSON.stringify(item.payload).length <= bytes)

    for (let i = 0; i < ops.length; i += limit) {
      const ok = await post('/api/sync/write', { ops: ops.slice(i, i + limit) })
      if (!ok) return false
    }

    return true
  }

  const flush = (id: string) => {
    const item = load(id)
    if (item.run) return item.run

    const next = (async () => {
      clear(id)
      const write = item.dirty

      try {
        const ops = [...item.drop.values()]
        if (ops.length) {
          const ok = await post('/api/sync/delete', { ops })
          if (!ok) return
          item.drop.clear()
        }

        if (!write) return
        item.dirty = false
        const ok = await push(id)
        if (ok) return
        item.dirty = true
      } catch (err) {
        if (write) item.dirty = true
        await log('transient push failure', { error: err instanceof Error ? err.message : String(err) })
      } finally {
        item.run = undefined
        if (item.dirty || item.drop.size) plan(id)
        else prune(id)
      }
    })()

    item.run = next
    return next
  }

  const sync = async (event: Event) => {
    switch (event.type) {
      case 'session.created':
      case 'session.updated':
      case 'message.updated':
      case 'message.part.updated':
      case 'todo.updated':
      case 'session.diff':
        mark(event.properties.sessionID)
        return

      case 'message.removed':
        drop(event.properties.sessionID, { entity: 'message', id: event.properties.messageID })
        return

      case 'message.part.removed':
        drop(event.properties.sessionID, { entity: 'part', id: event.properties.partID })
        return

      case 'session.deleted':
        drop(event.properties.sessionID, { entity: 'session', id: event.properties.sessionID })
        return

      case 'session.status':
        if (event.properties.status.type !== 'idle') return
        await flush(event.properties.sessionID)
        return

      case 'server.instance.disposed':
        await Promise.all([...state.keys()].map((id) => flush(id)))
        return
    }
  }

  // Bootstrap: seed all existing sessions on first connect (no-op if already seeded)
  const bootstrapLimit = 4000
  ;(async () => {
    try {
      const sessions: any[] = await localGet('/session').catch(() => [])
      if (!sessions.length) return

      const ops: Write[] = []
      for (const session of sessions) {
        const id = session.id
        const [messages, todos, diff] = await Promise.all([
          localGet(`/session/${id}/message`).then((d: any) => d ?? []).catch(() => []),
          localGet(`/session/${id}/todo`).then((d: any) => d ?? []).catch(() => []),
          localGet(`/session/${id}/diff`).then((d: any) => d ?? []).catch(() => []),
        ])

        ops.push({ entity: 'session', id, payload: session })
        for (const item of Array.isArray(messages) ? messages : []) {
          ops.push({ entity: 'message', id: item.info.id, session_id: id, payload: item.info })
          for (const p of item.parts ?? []) {
            const safe = p.type === 'file' && p.url?.startsWith('data:') ? { ...p, url: 'data:,' } : p
            ops.push({ entity: 'part', id: safe.id, session_id: id, message_id: safe.messageID, payload: safe })
          }
        }
        ops.push({ entity: 'todo', id, payload: todos })
        ops.push({ entity: 'session_diff', id, payload: JSON.stringify(diff).length > bytes ? [] : diff })
      }

      const safe = ops.filter((o) => JSON.stringify(o.payload).length <= bytes)

      // Send in chunks to stay under the 5000-op backend limit
      for (let i = 0; i < safe.length; i += bootstrapLimit) {
        const ok = await post('/api/sync/bootstrap', { ops: safe.slice(i, i + bootstrapLimit) })
        if (!ok) {
          await log('bootstrap rejected', { offset: i, total: safe.length })
          return
        }
      }
    } catch (err) {
      await log('bootstrap failed', { error: err instanceof Error ? err.message : String(err) })
    }
  })()

  return {
    event: ({ event }) => sync(event),
  }
}

export default plugin
