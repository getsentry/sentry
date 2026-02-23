/**
 * A thin wrapper around ffmpeg.wasm's UMD Web Worker, bypassing the
 * `@ffmpeg/ffmpeg` npm package's `FFmpeg` class.
 *
 * WHY: The `FFmpeg` class creates a `type: "module"` Worker from a
 * bundled worker.js file. Webpack can't properly handle the
 * `new Worker(new URL("./worker.js", import.meta.url))` pattern, and
 * the fallback UMD worker has its dynamic `import()` calls stubbed out
 * by webpack's module resolver. This means blob URLs can never be
 * loaded as ffmpeg core modules.
 *
 * SOLUTION: We create a **classic** Worker (no `type: "module"`) from
 * a blob that `importScripts()` the UMD worker from CDN. Inside a
 * classic worker, `importScripts(coreURL)` works natively, bypassing
 * all webpack module resolution. We then communicate with the worker
 * using the same message protocol the `FFmpeg` class uses.
 */

// The UMD worker file from @ffmpeg/ffmpeg — this is the code that runs
// inside the Web Worker and handles LOAD, EXEC, WRITE_FILE, etc.
const FFMPEG_WORKER_URL =
  'https://unpkg.com/@ffmpeg/ffmpeg@0.12.15/dist/umd/814.ffmpeg.js';

// The ffmpeg-core UMD build — loaded by the worker via importScripts()
const FFMPEG_CORE_URL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js';
const FFMPEG_WASM_URL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm';

/**
 * Message types matching ffmpeg.wasm's internal protocol.
 */
const MSG = {
  LOAD: 'LOAD',
  EXEC: 'EXEC',
  WRITE_FILE: 'WRITE_FILE',
  READ_FILE: 'READ_FILE',
  ERROR: 'ERROR',
  LOG: 'LOG',
  PROGRESS: 'PROGRESS',
} as const;

type LogCallback = (info: {message: string; type: string}) => void;

interface PendingRequest {
  reject: (err: Error) => void;
  resolve: (data: unknown) => void;
}

/**
 * Minimal ffmpeg.wasm client that creates a classic Worker from CDN
 * resources, avoiding all webpack bundling issues.
 */
export class FFmpegClient {
  private worker: Worker | null = null;
  private nextId = 0;
  private pending = new Map<number, PendingRequest>();
  private logCallback: LogCallback | null = null;

  /**
   * Register a callback that receives ffmpeg log messages (stderr output).
   */
  onLog(callback: LogCallback): void {
    this.logCallback = callback;
  }

  /**
   * Load ffmpeg-core.wasm inside the worker. Must be called before any
   * other method.
   */
  async load(): Promise<void> {
    // Create a classic Worker from a blob that importScripts the UMD worker
    // file from CDN. Classic workers support importScripts() natively, so
    // the worker can then importScripts(coreURL) to load ffmpeg-core.js.
    const blob = new Blob([`importScripts("${FFMPEG_WORKER_URL}");`], {
      type: 'text/javascript',
    });
    const blobURL = URL.createObjectURL(blob);

    this.worker = new Worker(blobURL);
    URL.revokeObjectURL(blobURL);

    this.worker.onmessage = ({data: {id, type, data}}) => {
      // Broadcast messages (no id) — LOG, PROGRESS, DOWNLOAD
      if (type === MSG.LOG) {
        this.logCallback?.(data);
        return;
      }
      if (type === MSG.PROGRESS) {
        // Could wire this up if needed
        return;
      }

      // Request/response messages
      const pending = this.pending.get(id);
      if (!pending) {
        return;
      }
      this.pending.delete(id);

      if (type === MSG.ERROR) {
        pending.reject(new Error(String(data)));
      } else {
        pending.resolve(data);
      }
    };

    // Send LOAD with the direct CDN URLs — the worker will importScripts
    // the core JS, which works because it's a classic worker and the CDN
    // has Access-Control-Allow-Origin: *
    await this.send(MSG.LOAD, {
      coreURL: FFMPEG_CORE_URL,
      wasmURL: FFMPEG_WASM_URL,
    });
  }

  /**
   * Write a file to ffmpeg's in-memory filesystem (Emscripten FS).
   */
  async writeFile(path: string, data: Uint8Array): Promise<void> {
    await this.send(MSG.WRITE_FILE, {path, data}, [data.buffer]);
  }

  /**
   * Execute an ffmpeg command. Returns the exit code (0 = success).
   */
  async exec(args: string[], timeout = -1): Promise<number> {
    return (await this.send(MSG.EXEC, {args, timeout})) as number;
  }

  /**
   * Read a file from ffmpeg's in-memory filesystem.
   */
  async readFile(path: string): Promise<Uint8Array> {
    return (await this.send(MSG.READ_FILE, {path})) as Uint8Array;
  }

  /**
   * Terminate the worker and release resources.
   */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    // Reject any pending requests
    for (const [, pending] of this.pending) {
      pending.reject(new Error('FFmpeg terminated'));
    }
    this.pending.clear();
  }

  private send(type: string, data: unknown, transfer?: Transferable[]): Promise<unknown> {
    if (!this.worker) {
      return Promise.reject(new Error('FFmpeg worker not loaded'));
    }

    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, {resolve, reject});
      this.worker!.postMessage({id, type, data}, transfer ?? []);
    });
  }
}
