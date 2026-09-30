import type {FrameVariable} from 'sentry/types/event';
import type {PlatformKey} from 'sentry/types/platform';

import {getStructuredDataConfig} from './getStructuredDataConfig';

/** Copy scalar values as text or complete collections as JSON. */
export function getFrameVariableCopyText(
  variable: FrameVariable,
  platform: PlatformKey
): string {
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
  if (variable.kind === 'array') {
    return variable.children.map(child => getCopyValue(child, platform));
  }
  if (variable.kind === 'object') {
    return Object.fromEntries(
      variable.children.map(child => [child.name, getCopyValue(child, platform)])
    );
  }

  switch (variable.kind) {
    case 'null':
      if (platform === 'node' && variable.value === '<undefined>') {
        return 'undefined';
      }
      return platform === 'native' ? 'nullptr' : null;
    case 'unavailable':
      return null;
    case 'boolean':
      return variable.value === 'true' || variable.value === 'True';
    case 'number':
      return platform === 'native' || platform === 'python'
        ? variable.value
        : Number(variable.value);
    default:
      return variable.value;
  }
}
