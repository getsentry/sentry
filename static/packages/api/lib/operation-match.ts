import { API_BASE_PATH } from "./api-base-path.gen.ts";
import type { ApiOperation } from "./operation-types.ts";

/** What a matcher needs from each operation: its method and path template. */
export type ApiOperationTemplate = Pick<ApiOperation, "method" | "path">;

/** The operation a concrete request path belongs to, with its path parameter values. */
export type ApiOperationMatch<Operation extends ApiOperationTemplate = ApiOperation> = {
  readonly operation: Operation;
  /** Decoded path parameter values, by the names in the operation's template. */
  readonly params: Readonly<Record<string, string>>;
};

/** Finds the operation for an HTTP method and a concrete path; see `createOperationMatcher`. */
export type ApiOperationMatcher<Operation extends ApiOperationTemplate = ApiOperation> = (
  method: string,
  path: string,
) => ApiOperationMatch<Operation> | undefined;

type Node<Operation> = {
  readonly literals: Map<string, Node<Operation>>;
  param?: Node<Operation>;
  readonly operations: Map<string, { readonly operation: Operation; readonly names: readonly string[] }>;
};

const node = <Operation>(): Node<Operation> => ({ literals: new Map(), operations: new Map() });

// Resolves the input's path; the origin itself is never used.
const PLACEHOLDER_ORIGIN = "https://placeholder.invalid";

const segments = (path: string) => path.split("/").filter(Boolean);

/** `{name}` for a parameter segment, otherwise undefined. */
function parameterName(segment: string): string | undefined {
  return segment.startsWith("{") && segment.endsWith("}") ? segment.slice(1, -1) : undefined;
}

function decode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/**
 * Build a matcher from operation path templates, such as the shipped
 * `operations` catalog or a filtered or extended copy of it.
 *
 * The matcher takes a method and a concrete path, such as
 * `GET /api/0/organizations/acme/issues/`, and returns the operation whose
 * template matches it. The path may include `API_BASE_PATH`, also under a
 * prefix such as `/sentry/api/0/`, a query string, or an origin, and empty
 * segments are ignored, so a missing trailing slash
 * still matches. A literal segment wins over a parameter at the first segment
 * where templates differ, so `/snapshots/latest-base/` wins over
 * `/snapshots/{snapshot_id}/`.
 *
 * The matcher indexes the templates on its first call, which throws when two
 * templates for one method differ only in parameter names, because neither
 * would win.
 */
export function createOperationMatcher<Operation extends ApiOperationTemplate>(
  operations: readonly Operation[],
): ApiOperationMatcher<Operation> {
  let root: Node<Operation> | undefined;
  return (method, path) => {
    root ??= buildIndex(operations);
    if (!URL.canParse(path, PLACEHOLDER_ORIGIN)) return;
    let pathname = new URL(path, PLACEHOLDER_ORIGIN).pathname;
    // Anywhere in the path: a self-hosted install may serve the API under a prefix.
    const base = pathname.indexOf(`${API_BASE_PATH}/`);
    if (base !== -1) {
      pathname = pathname.slice(base + API_BASE_PATH.length);
    } else if (pathname.endsWith(API_BASE_PATH)) {
      pathname = "/";
    }
    return find(root, segments(pathname), 0, [], method.toUpperCase());
  };
}

function buildIndex<Operation extends ApiOperationTemplate>(operations: readonly Operation[]): Node<Operation> {
  const root = node<Operation>();
  for (const operation of operations) {
    let current = root;
    const names: string[] = [];
    for (const segment of segments(operation.path)) {
      const name = parameterName(segment);
      if (name === undefined) {
        const next = current.literals.get(segment) ?? node<Operation>();
        current.literals.set(segment, next);
        current = next;
      } else {
        names.push(name);
        current = current.param ??= node<Operation>();
      }
    }
    const method = operation.method.toUpperCase();
    const existing = current.operations.get(method);
    if (existing) {
      throw new Error(
        `Ambiguous operation templates: ${method} ${existing.operation.path} and ${method} ${operation.path}`,
      );
    }
    current.operations.set(method, { operation, names });
  }
  return root;
}

/** Match `path` from `position` on, trying a literal segment before a parameter. */
function find<Operation extends ApiOperationTemplate>(
  current: Node<Operation>,
  path: readonly string[],
  position: number,
  values: readonly string[],
  method: string,
): ApiOperationMatch<Operation> | undefined {
  if (position === path.length) {
    const found = current.operations.get(method);
    if (!found) return;
    return {
      operation: found.operation,
      params: Object.fromEntries(found.names.map((name, i) => [name, values[i]!])),
    };
  }
  const segment = path[position]!;
  const literal = current.literals.get(decode(segment));
  const match = literal && find(literal, path, position + 1, values, method);
  if (match) return match;
  return current.param && find(current.param, path, position + 1, [...values, decode(segment)], method);
}
