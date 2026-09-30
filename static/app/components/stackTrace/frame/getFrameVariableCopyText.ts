import {t} from 'sentry/locale';
import type {FrameVariable} from 'sentry/types/event';
import type {PlatformKey} from 'sentry/types/platform';

import {getStructuredDataConfig} from './getStructuredDataConfig';

/** Copy scalar values as text or captured collections as JSON, using annotated display text. */
export function getFrameVariableCopyText(
  variable: FrameVariable,
  platform: PlatformKey
): string {
  const value = getCopyValue(variable, platform);
  const config = getStructuredDataConfig({platform});
  if (value === null && config.renderNull) {
    return String(config.renderNull(null));
  }
  if (typeof value === 'boolean' && config.renderBoolean) {
    return String(config.renderBoolean(value));
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

  const {meta} = variable;
  if (meta?.chunks && meta.chunks.length > 1) {
    return meta.chunks.map(chunk => chunk.text).join('');
  }

  const hasValue =
    variable.kind !== 'null' && 'value' in variable && Boolean(variable.value);
  if (!hasValue && meta?.err?.length) {
    return `<${t('invalid')}>`;
  }
  if (!hasValue && meta?.rem?.length) {
    return `<${t('redacted')}>`;
  }

  switch (variable.kind) {
    case 'null':
      if (platform === 'node' && variable.value === '<undefined>') {
        return 'undefined';
      }
      return platform === 'native' ? 'nullptr' : null;
    case 'unavailable':
      return t('Unavailable');
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
