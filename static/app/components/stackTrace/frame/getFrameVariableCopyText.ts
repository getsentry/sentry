import type {FrameVariable} from 'sentry/types/event';
import type {PlatformKey} from 'sentry/types/platform';

import {getStructuredDataConfig} from './getStructuredDataConfig';

/** Copy scalar values as text or available collection values as JSON. */
export function getFrameVariableCopyText(
  variable: FrameVariable,
  platform: PlatformKey
): string | undefined {
  if (
    (variable.kind === 'array' || variable.kind === 'object') &&
    variable.children.length === 0
  ) {
    return undefined;
  }
  const value = getCopyValue(variable, platform);
  const config = getStructuredDataConfig({platform});
  if (value === null && config.renderNull) {
    return config.renderNull(null);
  }
  if (typeof value === 'boolean' && config.renderBoolean) {
    return config.renderBoolean(value);
  }
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

function getCopyValue(variable: FrameVariable, platform: PlatformKey): unknown {
  if (variable.kind === 'array' || variable.kind === 'object') {
    let value: unknown[] | Record<string, unknown>;
    if (variable.kind === 'array') {
      value = variable.children.map(child => getCopyValue(child, platform));
    } else {
      value = Object.fromEntries(
        variable.children.map(child => [child.name, getCopyValue(child, platform)])
      );
    }
    if (variable.children.length === 0) {
      if (variable.meta?.len || variable.meta?.rem?.length) {
        return undefined;
      }
      return value;
    }
    if (Object.values(value).every(child => child === undefined)) {
      return undefined;
    }
    return value;
  }

  const {meta} = variable;
  if (meta?.chunks?.length) {
    if (!meta.chunks.some(chunk => chunk.type === 'text' && chunk.text)) {
      return undefined;
    }
    return meta.chunks.map(chunk => chunk.text).join('');
  }
  if (meta?.err?.length || meta?.rem?.some(([ruleId]) => ruleId !== '!limit')) {
    return undefined;
  }

  switch (variable.kind) {
    case 'null':
      if (meta?.rem?.length) {
        return undefined;
      }
      if (platform === 'node' && variable.value === '<undefined>') {
        return 'undefined';
      }
      return platform === 'native' ? 'nullptr' : null;
    case 'unavailable':
      return undefined;
    case 'boolean':
      return variable.value === 'true' || variable.value === 'True';
    case 'number':
      if (platform === 'python') {
        // Emit Python numbers as unquoted JSON without converting through Number,
        // which would round large integers.
        // Access JSON directly so SWC detects and injects the required polyfill.
        // @ts-expect-error The project's TypeScript lib does not yet declare JSON.rawJSON.
        return JSON.rawJSON(variable.value);
      }
      return platform === 'native' ? variable.value : Number(variable.value);
    default:
      return variable.value;
  }
}
