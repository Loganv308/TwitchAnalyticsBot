/**
 * LogStream Client — JavaScript / TypeScript
 *
 * Works in Node.js (v18+). Zero dependencies.
 *
 * Usage (ESM):
 *   import { LogStream } from './logstream.js'
 *   const log = new LogStream({ service: 'my-app', host: 'http://192.168.1.97:3000' })
 *   log.info('Server started')
 *   log.error('Something broke', { code: 500, path: '/api/users' })
 *
 * Usage (CommonJS):
 *   const { LogStream } = require('./logstream.js')
 */

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL'

interface LogEntry {
  level:     LogLevel
  service:   string
  message:   string
  ts:        string
  metadata?: Record<string, unknown>
}

interface LogStreamOptions {
  /** Your service name — appears in the LogStream UI */
  service: string
  /** LogStream server URL. Default: http://192.168.1.97:3000 */
  host?: string
  /** How many logs to batch before sending. Default: 10 */
  batchSize?: number
  /** How often (ms) to flush queued logs. Default: 2000 */
  flushInterval?: number
  /** Max queued logs before dropping. Default: 1000 */
  maxQueue?: number
}

export class LogStream {
  private readonly service:       string
  private readonly url:           string
  private readonly batchSize:     number
  private readonly maxQueue:      number
  private readonly queue:         LogEntry[] = []
  private readonly timer:         ReturnType<typeof setInterval>

  constructor(opts: LogStreamOptions) {
    this.service   = opts.service
    this.url       = `${(opts.host ?? 'http://192.168.1.97:3000').replace(/\/$/, '')}/api/ingest/batch`
    this.batchSize = opts.batchSize    ?? 10
    this.maxQueue  = opts.maxQueue     ?? 1000

    // Flush on interval
    this.timer = setInterval(() => this.flush(), opts.flushInterval ?? 2000)

    // Don't keep the Node process alive just for logging
    if (typeof this.timer.unref === 'function') this.timer.unref()

    // Best-effort flush on exit
    process.on('beforeExit', () => this.flush())
  }

  // ── Public methods ────────────────────────────────────────────────────────

  debug(message: string, metadata?: Record<string, unknown>): void {
    this.enqueue('DEBUG', message, metadata)
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.enqueue('INFO', message, metadata)
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.enqueue('WARN', message, metadata)
  }

  error(message: string, metadata?: Record<string, unknown>): void {
    this.enqueue('ERROR', message, metadata)
  }

  fatal(message: string, metadata?: Record<string, unknown>): void {
    this.enqueue('FATAL', message, metadata)
  }

  /** Force flush queued logs immediately */
  flush(): void {
    if (this.queue.length === 0) return
    const batch = this.queue.splice(0, this.batchSize)
    this.send(batch)
  }

  /** Stop the flush timer */
  close(): void {
    clearInterval(this.timer)
    this.flush()
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private enqueue(level: LogLevel, message: string, metadata?: Record<string, unknown>): void {
    if (this.queue.length >= this.maxQueue) this.queue.shift();
    
    const entry: LogEntry = {
      level,
      service: this.service,
      message,
      ts:      new Date().toISOString(),
      ...(metadata !== undefined && { metadata }), // only include if defined
    };
    
    this.queue.push(entry);
    if (this.queue.length >= this.batchSize) this.flush();
  }

  private send(batch: LogEntry[]): void {
    fetch(this.url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(batch),
      signal:  AbortSignal.timeout(3000),
    }).catch(() => {}) // never throw — logging must not crash the app
  }
}

// ── Winston transport (optional) ──────────────────────────────────────────

/**
 * Usage:
 *   import winston from 'winston'
 *   import { LogStreamTransport } from './logstream.js'
 *
 *   const logger = winston.createLogger({
 *     transports: [
 *       new winston.transports.Console(),
 *       new LogStreamTransport({ service: 'my-app', host: 'http://192.168.1.97:3000' }),
 *     ],
 *   })
 *
 *   logger.info('Hello')
 *   logger.error('Broke', { metadata: { code: 500 } })
 */
export class LogStreamTransport {
  private client: LogStream
  readonly name = 'LogStream'

  constructor(opts: LogStreamOptions) {
    this.client = new LogStream(opts)
  }

  private static toLevel(level: string): LogLevel {
    const map: Record<string, LogLevel> = {
      debug:   'DEBUG',
      info:    'INFO',
      warn:    'WARN',
      warning: 'WARN',
      error:   'ERROR',
      fatal:   'FATAL',
      crit:    'FATAL',
    }
    return map[level.toLowerCase()] ?? 'INFO'
  }

  log(info: { level: string; message: string; metadata?: Record<string, unknown> }, callback: () => void): void {
    this.client['enqueue'](LogStreamTransport.toLevel(info.level), info.message, info.metadata)
    callback()
  }
}
