import type {NativeFrameVariable} from 'sentry/types/event';
import type {Meta} from 'sentry/types/group';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Convert JSON variables into the tree preview model, preserving annotations at each path. */
export function getJsonFrameVariables(
  data: Record<string, unknown>,
  meta?: Record<string, unknown>
): NativeFrameVariable[] {
  return Object.keys(data)
    .sort()
    .map(name => toVariable(name, data[name], meta?.[name]));
}

function toVariable(name: string, value: unknown, meta: unknown): NativeFrameVariable {
  const localMeta = isRecord(meta) ? meta : undefined;
  const valueMeta = localMeta?.[''];
  const base = {
    name,
    meta: isRecord(valueMeta) ? (valueMeta as Partial<Meta>) : undefined,
  };

  if (value === null) {
    return {...base, kind: 'null'};
  }
  if (Array.isArray(value)) {
    return {
      ...base,
      kind: 'array',
      children: value.map((child, index) =>
        toVariable(`[${index}]`, child, localMeta?.[index])
      ),
    };
  }
  if (isRecord(value)) {
    return {
      ...base,
      kind: 'object',
      children: getJsonFrameVariables(value, localMeta),
    };
  }

  switch (typeof value) {
    case 'string':
      return {...base, kind: 'string', value};
    case 'number':
      return {...base, kind: 'number', value: String(value)};
    case 'boolean':
      return {...base, kind: 'boolean', value: String(value)};
    default:
      return {...base, kind: 'unavailable'};
  }
}
