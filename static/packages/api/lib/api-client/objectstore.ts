/**
 * Objectstore client for uploading files, such as snapshot images, through the
 * service that Sentry's upload-options endpoints return
 * (e.g. `snapshots/upload-options/`).
 *
 * Implements the subset of the `objectstore-client` protocol
 * (getsentry/objectstore) that uploads need: find which objects already exist,
 * then upload the missing ones. The service URL, scopes, auth token, and
 * expiration policy come from the Sentry API; this client never signs tokens.
 *
 * Object path layout: `{url}/v1/objects/{usecase}/{scope}/{key}`, where `scope`
 * is a `;`-joined list of ordered `key=value` pairs. Auth is carried in the
 * `x-os-auth: Bearer <token>` header, not `Authorization`.
 *
 * Like the Rust client's `Session::many()`, HEADs and small inserts are grouped
 * into multipart requests to `{url}/v1/objects:batch/{usecase}/{scope}/`. The
 * Sentry proxy in front of Objectstore rate-limits each HTTP request, so one
 * request per object trips it (HTTP 429) on larger uploads. Batches use the
 * JSON layout of the batch endpoint, which carries all operation data in form
 * fields, so requests and responses go through web-standard `FormData`.
 *
 * Uses only web-standard APIs. Hosts supply file contents through
 * {@link ObjectUpload.read} and may inject `fetch` (e.g. for custom CAs).
 */

import pLimit, { type LimitFunction } from "p-limit";
import { ApiError } from "./errors.js";

/** Header carrying the Objectstore bearer token. */
const AUTH_HEADER = "x-os-auth";
/** Header carrying an object's expiration policy (e.g. `ttl:30d`). */
const EXPIRATION_HEADER = "x-sn-expiration";

/** Matches one or more trailing slashes (for base-URL normalization). */
const TRAILING_SLASHES = /\/+$/;

/** Timeout for uploading a single object. */
const PUT_TIMEOUT_MS = 120_000;
/** Timeout for one batch request (up to {@link MAX_BATCH_BODY_SIZE} bytes). */
const BATCH_TIMEOUT_MS = 300_000;

/** Suffix of the part name that carries an operation's object bytes (`"0.payload"`). */
const PAYLOAD_SUFFIX = ".payload";
/** Matches the name of a result part, which is its operation's index. */
const INDEX_NAME = /^\d+$/;

/** Server-enforced maximum number of operations per batch request. */
const MAX_BATCH_OPS = 1000;
/** Server-enforced maximum body size of one batch part; larger objects are PUT individually. */
const MAX_BATCH_PART_SIZE = 1024 * 1024;
/**
 * Maximum total body size of one batch request. With {@link BATCH_CONCURRENCY}
 * batches in flight, upload bodies held in memory stay around 100 MB.
 */
const MAX_BATCH_BODY_SIZE = 25 * 1024 * 1024;
/**
 * Batch requests in flight at once. Each batch is one request to the Sentry
 * proxy, so this stays far below its per-request rate limit.
 */
const BATCH_CONCURRENCY = 4;
/** Concurrency for objects too large to batch (matches the Rust client). */
const INDIVIDUAL_CONCURRENCY = 5;

const encoder = new TextEncoder();

/**
 * Objectstore upload configuration, as returned (camelCase) by the Sentry
 * upload-options endpoints.
 */
export type ObjectstoreConfig = {
  /** Base service URL (may include a path prefix). */
  url: string;
  usecase: string;
  /** Ordered scope pairs (e.g. `[["org","1"],["project","2"]]`). */
  scopes: [string, string][];
  /** Pre-signed bearer token, or null/absent for unauthenticated stores. */
  authToken?: string | null;
  /** Expiration policy string applied to uploaded objects. */
  expirationPolicy: string;
};

/** Host capabilities for Objectstore requests. */
export type ObjectstoreOptions = {
  /** Fetch to send requests with. Defaults to `globalThis.fetch`. */
  fetch?: (input: string, init?: RequestInit) => Promise<Response>;
};

/** A file to upload under an object key. */
export type ObjectUpload = {
  key: string;
  /** Size in bytes, used to group uploads before any file is read. */
  size: number;
  /** Read the file's bytes. Called once, when its request starts. */
  read: () => Promise<Uint8Array<ArrayBuffer>>;
};

/**
 * A failed Objectstore request or operation. `url` is the object URL for a
 * failed operation, or the request URL for a failed request.
 */
export class ObjectstoreError extends ApiError {
  constructor(
    message: string,
    status: number,
    detail: string,
    public readonly url: string,
  ) {
    super(message, status, detail);
    this.name = "ObjectstoreError";
    Object.setPrototypeOf(this, ObjectstoreError.prototype);
  }
}

/** Render scope pairs into the `k=v;k=v` path segment. */
function scopeSegment(scopes: [string, string][]): string {
  return scopes.map(([key, value]) => `${key}=${value}`).join(";");
}

/**
 * Build the full URL for an object key within the configured usecase + scope.
 *
 * @param config - The objectstore configuration.
 * @param key - The object key (e.g. `<orgId>/<projectId>/<sha256>`).
 */
function buildObjectUrl(config: ObjectstoreConfig, key: string): string {
  const base = config.url.replace(TRAILING_SLASHES, "");
  const path = key.split("/").map(encodePathSegment).join("/");
  return `${base}/v1/objects/${config.usecase}/${scopeSegment(config.scopes)}/${path}`;
}

/** Build the batch endpoint URL for the configured usecase + scope. */
function buildBatchUrl(config: ObjectstoreConfig): string {
  const base = config.url.replace(TRAILING_SLASHES, "");
  return `${base}/v1/objects:batch/${config.usecase}/${scopeSegment(config.scopes)}/`;
}

/** Percent-encode the UTF-8 bytes of `value` that are controls, DEL, non-ASCII, or in `reserved`. */
function percentEncode(value: string, reserved: string): string {
  let out = "";
  for (const byte of encoder.encode(value)) {
    if (byte < 0x20 || byte >= 0x7f || reserved.includes(String.fromCharCode(byte))) {
      out += `%${byte.toString(16).toUpperCase().padStart(2, "0")}`;
    } else {
      out += String.fromCharCode(byte);
    }
  }
  return out;
}

/**
 * Escape one key segment for an object URL, matching the Rust client, which
 * pushes each `/`-separated part of the key with the `url` crate's
 * `SPECIAL_PATH_SEGMENT` encode set (http(s) URLs). That set includes `\`,
 * which those URLs would otherwise parse as `/`.
 */
function encodePathSegment(segment: string): string {
  return percentEncode(segment, ' "#%<>?^`{}\\');
}

/** Auth headers for an objectstore request, if a token is configured. */
function authHeaders(config: ObjectstoreConfig): Record<string, string> {
  return config.authToken ? { [AUTH_HEADER]: `Bearer ${config.authToken}` } : {};
}

function fetchFor(options: ObjectstoreOptions | undefined) {
  return options?.fetch ?? ((input: string, init?: RequestInit) => globalThis.fetch(input, init));
}

/**
 * Upload one object's bytes, raw (no content encoding).
 *
 * @throws {ObjectstoreError} On a non-2xx response.
 */
async function putObject(
  config: ObjectstoreConfig,
  key: string,
  body: Uint8Array<ArrayBuffer>,
  options?: ObjectstoreOptions,
): Promise<void> {
  const url = buildObjectUrl(config, key);
  const response = await fetchFor(options)(url, {
    method: "PUT",
    headers: { ...authHeaders(config), [EXPIRATION_HEADER]: config.expirationPolicy },
    body,
    signal: AbortSignal.timeout(PUT_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new ObjectstoreError(
      "Objectstore upload failed",
      response.status,
      response.statusText || "PUT failed",
      url,
    );
  }
}

/** One operation within a batch request. */
type BatchOperation =
  | { kind: "head"; key: string }
  | { kind: "insert"; key: string; body: Uint8Array<ArrayBuffer> };

/** Outcome of one batch operation, as reported in its result part. */
type BatchOperationResult = {
  /** HTTP status of this operation (e.g. 200, 201, 404, 429). */
  status: number;
  /** Error description for a failed operation, or empty. */
  message: string;
};

/**
 * Build a batch request in the JSON layout: a JSON descriptor field named by
 * the operation index, followed for inserts by a `"<index>.payload"` file.
 */
function encodeBatchForm(config: ObjectstoreConfig, operations: BatchOperation[]): FormData {
  const form = new FormData();
  operations.forEach((op, index) => {
    const name = String(index);
    if (op.kind === "insert") {
      const metadata = { expiration: config.expirationPolicy };
      form.append(name, JSON.stringify({ kind: op.kind, key: op.key, metadata }));
      form.append(`${name}${PAYLOAD_SUFFIX}`, new Blob([op.body]), name);
    } else {
      form.append(name, JSON.stringify({ kind: op.kind, key: op.key }));
    }
  });
  return form;
}

/**
 * Read the result of one operation from the JSON body of its result part,
 * such as `{"status":404,"kind":"head","key":"a"}`. A failure carries the
 * standard error body in `error`, whose `detail` includes its causes.
 */
function parseResult(body: string): BatchOperationResult | undefined {
  let result: { status?: unknown; error?: { detail?: unknown } | null } | null;
  try {
    result = JSON.parse(body);
  } catch {
    return undefined;
  }
  if (typeof result?.status !== "number") {
    return undefined;
  }
  const detail = result.error?.detail;
  return { status: result.status, message: typeof detail === "string" ? detail : "" };
}

/**
 * Parse a batch response into per-operation results, keyed by operation
 * index. Results arrive in completion order as JSON fields named by index;
 * payload parts (`"<index>.payload"`) only follow GETs and are skipped.
 */
async function parseBatchResponse(
  response: Response,
  url: string,
): Promise<Map<number, BatchOperationResult>> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    throw new ObjectstoreError(
      "Objectstore batch response is not multipart",
      502,
      `Unexpected Content-Type: ${contentType || "(none)"}`,
      url,
    );
  }
  let form: FormData;
  try {
    form = await response.formData();
  } catch (error) {
    throw new ObjectstoreError(
      "Objectstore batch response is malformed",
      502,
      error instanceof Error ? error.message : String(error),
      url,
    );
  }

  const results = new Map<number, BatchOperationResult>();
  for (const [name, value] of form) {
    if (!INDEX_NAME.test(name)) {
      continue;
    }
    const result = parseResult(typeof value === "string" ? value : await value.text());
    if (result) {
      results.set(Number(name), result);
    }
  }
  return results;
}

/**
 * Send operations as one batch request.
 *
 * @returns Results aligned with `operations` by index.
 * @throws {ObjectstoreError} When the batch request itself fails or the
 *   response is missing a result for any operation.
 */
async function sendBatch(
  config: ObjectstoreConfig,
  operations: BatchOperation[],
  options: ObjectstoreOptions | undefined,
): Promise<BatchOperationResult[]> {
  const url = buildBatchUrl(config);
  const response = await fetchFor(options)(url, {
    method: "POST",
    // fetch sets the multipart `Content-Type` and boundary for a FormData body.
    headers: authHeaders(config),
    body: encodeBatchForm(config, operations),
    signal: AbortSignal.timeout(BATCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new ObjectstoreError(
      "Objectstore batch request failed",
      response.status,
      response.statusText || "batch request failed",
      url,
    );
  }

  const parsed = await parseBatchResponse(response, url);
  return operations.map((op, index) => {
    const result = parsed.get(index);
    if (!result) {
      throw new ObjectstoreError(
        "Objectstore batch response is incomplete",
        502,
        `No result for ${op.kind} of ${op.key}`,
        url,
      );
    }
    return result;
  });
}

/** Throw an {@link ObjectstoreError} for a failed operation inside a batch. */
function throwOperationError(
  config: ObjectstoreConfig,
  message: string,
  key: string,
  result: BatchOperationResult,
): never {
  throw new ObjectstoreError(
    message,
    result.status,
    result.message || `HTTP ${result.status}`,
    buildObjectUrl(config, key),
  );
}

/** Split `items` into consecutive chunks of at most `size` items. */
function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Wrap `task` so that its failure clears every queue in `limits` before the
 * limiter can start the next task: after the first error, no new request
 * starts and no further upload is read. Cleared tasks never settle, which is
 * fine: the caller's `Promise.all` has already rejected with the first error,
 * and pending promises hold no timers or handles.
 */
function stopOnFailure(
  limits: LimitFunction[],
  task: () => Promise<void>,
): () => Promise<void> {
  return async () => {
    try {
      await task();
    } catch (error) {
      for (const limit of limits) {
        limit.clearQueue();
      }
      throw error;
    }
  };
}

/**
 * Find which keys already exist, using batched HEAD operations (one request
 * per {@link MAX_BATCH_OPS} keys, up to {@link BATCH_CONCURRENCY} at once).
 *
 * @returns The subset of `keys` that exist.
 * @throws {ObjectstoreError} On a failed batch, or any HEAD result other than 2xx/404.
 */
export async function findExistingObjects(
  config: ObjectstoreConfig,
  keys: string[],
  options?: ObjectstoreOptions,
): Promise<Set<string>> {
  const existing = new Set<string>();
  const limit = pLimit(BATCH_CONCURRENCY);
  await Promise.all(
    chunk(keys, MAX_BATCH_OPS).map((batch) =>
      limit(stopOnFailure([limit], async () => {
        const results = await sendBatch(
          config,
          batch.map((key) => ({ kind: "head", key })),
          options,
        );
        results.forEach((result, i) => {
          const key = batch[i] as string;
          if (result.status === 404) {
            return;
          }
          if (result.status >= 400) {
            throwOperationError(config, "Objectstore HEAD failed", key, result);
          }
          existing.add(key);
        });
      })),
    ),
  );
  return existing;
}

/** Group uploads into batches within the op-count and body-size limits. */
function groupBatches(uploads: ObjectUpload[]): ObjectUpload[][] {
  const batches: ObjectUpload[][] = [];
  let current: ObjectUpload[] = [];
  let currentSize = 0;
  for (const upload of uploads) {
    if (
      current.length >= MAX_BATCH_OPS ||
      (current.length > 0 && currentSize + upload.size > MAX_BATCH_BODY_SIZE)
    ) {
      batches.push(current);
      current = [];
      currentSize = 0;
    }
    current.push(upload);
    currentSize += upload.size;
  }
  if (current.length > 0) {
    batches.push(current);
  }
  return batches;
}

/**
 * Upload objects. Uploads up to {@link MAX_BATCH_PART_SIZE} are sent in batch
 * requests, up to {@link BATCH_CONCURRENCY} at once; larger ones are PUT
 * individually, up to {@link INDIVIDUAL_CONCURRENCY} at once. Both run in
 * parallel. Each upload is read only when its request starts.
 *
 * @throws {ObjectstoreError} On a failed batch, or any failed insert.
 */
export async function putObjects(
  config: ObjectstoreConfig,
  uploads: ObjectUpload[],
  options?: ObjectstoreOptions,
): Promise<void> {
  const batchable = uploads.filter((u) => u.size <= MAX_BATCH_PART_SIZE);
  const individual = uploads.filter((u) => u.size > MAX_BATCH_PART_SIZE);

  const batchLimit = pLimit(BATCH_CONCURRENCY);
  const individualLimit = pLimit(INDIVIDUAL_CONCURRENCY);
  const limits = [batchLimit, individualLimit];
  await Promise.all([
    ...groupBatches(batchable).map((batch) =>
      batchLimit(stopOnFailure(limits, async () => {
        // Read one upload at a time, so batches in flight hold at most
        // BATCH_CONCURRENCY files open, not up to MAX_BATCH_OPS each.
        const operations: BatchOperation[] = [];
        for (const upload of batch) {
          operations.push({ kind: "insert", key: upload.key, body: await upload.read() });
        }
        const results = await sendBatch(config, operations, options);
        results.forEach((result, i) => {
          if (result.status >= 400) {
            const key = (batch[i] as ObjectUpload).key;
            throwOperationError(config, "Objectstore upload failed", key, result);
          }
        });
      })),
    ),
    ...individual.map((upload) =>
      individualLimit(stopOnFailure(limits, async () => {
        await putObject(config, upload.key, await upload.read(), options);
      })),
    ),
  ]);
}
