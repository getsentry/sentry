import type {
  FrameVariable,
  NativeFrameVariable,
  NativeFrameVariableValue,
} from 'sentry/types/event';
import type {Meta} from 'sentry/types/group';
import type {PlatformKey} from 'sentry/types/platform';

import {getStructuredDataConfig} from './getStructuredDataConfig';

const NULL_ADDRESS_REGEX = /^0x0+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Every record below a native variable is a value. `type` cannot identify one: Relay
 * drops the keys after the point where a frame's variables exceed its size limit, in
 * alphabetical order, so a value cut inside its members has no `type`.
 */
function isNativeValue(value: unknown): value is NativeFrameVariableValue {
  return isRecord(value);
}

/** `kind` is the first key of a variable, so it is the last one the size limit drops. */
function isNativeVariable(value: unknown): value is NativeFrameVariable {
  return isRecord(value) && (value.kind === 'local' || value.kind === 'parameter');
}

/**
 * Convert a Symbolicator value into a tree node. A pointer becomes the value it points to,
 * with the addresses that lead there; a pointer that could not be dereferenced becomes
 * its last address, or null when that address is zero.
 */
function toNativeVariable(
  name: string,
  value: NativeFrameVariableValue,
  meta: unknown
): FrameVariable {
  const addresses: string[] = [];
  let target = value;
  let targetMeta = isRecord(meta) ? meta : undefined;
  for (;;) {
    addresses.push(...[target.pointer_address ?? []].flat());
    // TODO: Remove once https://github.com/getsentry/symbolicator/pull/2211 is deployed
    // and pointees are part of the pointer's own value.
    if (!isNativeValue(target.pointee)) {
      break;
    }
    targetMeta = isRecord(targetMeta?.pointee) ? targetMeta.pointee : undefined;
    target = target.pointee;
  }

  const ownMeta = targetMeta?.[''];
  const base = {
    name,
    type: value.type || undefined,
    meta: isRecord(ownMeta) ? (ownMeta as Partial<Meta>) : undefined,
  };
  const pointer = addresses.length > 0 ? {pointerAddresses: addresses} : undefined;

  if (isRecord(target.members) && Object.keys(target.members).length > 0) {
    const membersMeta = isRecord(targetMeta?.members) ? targetMeta.members : undefined;
    const collectionMeta = membersMeta?.[''];
    return {
      ...base,
      ...pointer,
      meta: isRecord(collectionMeta) ? (collectionMeta as Partial<Meta>) : base.meta,
      kind: 'object',
      // Keep the order of the payload. Symbolicator lists members in declaration order,
      // but Relay sorts the keys of a stored event, so they arrive in alphabetical order.
      children: Object.entries(target.members).map(([memberName, member]) =>
        toNativeMember(memberName, member, membersMeta?.[memberName])
      ),
    };
  }

  // A pointee that is not a value, or members that are not a record, were serialized to
  // a string by Relay's depth limit.
  const serialized = typeof target.members === 'string' ? 'members' : 'pointee';
  const [formatted, formattedMeta] =
    target.value === undefined
      ? [target[serialized], targetMeta?.[serialized]]
      : [target.value, targetMeta?.value];
  if (formatted !== undefined) {
    return {
      ...toVariable(name, formatted, formattedMeta, 'native'),
      ...pointer,
      type: base.type,
    };
  }

  const lastAddress = addresses.at(-1);
  if (lastAddress === undefined) {
    return {...base, kind: 'unavailable'};
  }
  const leading = addresses.length > 1 ? {pointerAddresses: addresses.slice(0, -1)} : {};
  return NULL_ADDRESS_REGEX.test(lastAddress)
    ? {...base, ...leading, kind: 'null'}
    : {...base, ...leading, kind: 'unformatted', value: lastAddress};
}

function toNativeMember(
  name: string,
  value: NativeFrameVariableValue | string,
  meta: unknown
): FrameVariable {
  // Relay's depth limit serializes deeply nested values to strings, show those verbatim.
  return isNativeValue(value)
    ? toNativeVariable(name, value, meta)
    : toVariable(name, value, meta, 'native');
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
    return toNativeVariable(name, value, meta);
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
