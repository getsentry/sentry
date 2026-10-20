import type {FrameVariable, NativeFrameVariable} from 'sentry/types/event';
import type {Meta} from 'sentry/types/group';
import type {PlatformKey} from 'sentry/types/platform';

import {getStructuredDataConfig} from './getStructuredDataConfig';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNativeVariable(value: unknown): value is NativeFrameVariable {
  return isRecord(value) && 'formatted' in value;
}

/** Convert frame variables into a tree, preserving SDK formatting and annotations at each path. */
export function getJsonFrameVariables(
  data: Record<string, unknown>,
  meta?: Record<string, unknown>,
  platform?: PlatformKey
): FrameVariable[] {
  return Object.keys(data)
    .sort()
    .map(name => toVariable(name, data[name], meta?.[name], platform));
}

function toVariable(
  name: string,
  value: unknown,
  meta: unknown,
  platform?: PlatformKey
): FrameVariable {
  const config = getStructuredDataConfig({platform});
  const localMeta = isRecord(meta) ? meta : undefined;
  const valueMeta = localMeta?.[''];
  const base = {
    name,
    meta: isRecord(valueMeta) ? (valueMeta as Partial<Meta>) : undefined,
  };

  if (platform === 'native' && isNativeVariable(value)) {
    const formattedMeta = localMeta?.formatted as {'': Partial<Meta>} | undefined;
    const nativeBase = {
      ...base,
      type: value.type,
      meta: formattedMeta?.[''] ?? base.meta,
    };
    return value.formatted === null
      ? {...nativeBase, kind: 'unavailable'}
      : {...nativeBase, kind: 'unformatted', value: value.formatted};
  }

  if (value === null || config.isNull?.(value)) {
    return typeof value === 'string'
      ? {...base, kind: 'null', value}
      : {...base, kind: 'null'};
  }
  if (
    typeof value === 'boolean' ||
    (typeof value === 'string' && config.isBoolean?.(value))
  ) {
    return {...base, kind: 'boolean', value: String(value)};
  }
  if (
    typeof value === 'number' ||
    (typeof value === 'string' && config.isNumber?.(value))
  ) {
    return {...base, kind: 'number', value: String(value)};
  }
  if (Array.isArray(value)) {
    return {
      ...base,
      kind: 'array',
      children: value.map((child, index) =>
        toVariable(`[${index}]`, child, localMeta?.[index], platform)
      ),
    };
  }
  if (isRecord(value)) {
    return {
      ...base,
      kind: 'object',
      children: getJsonFrameVariables(value, localMeta, platform),
    };
  }

  if (typeof value !== 'string') {
    return {...base, kind: 'unavailable'};
  }
  if (platform === 'native' || (platform === 'python' && !config.isString?.(value))) {
    return {...base, kind: 'unformatted', value};
  }
  return {...base, kind: 'string', value: config.renderString?.(value) ?? value};
}
