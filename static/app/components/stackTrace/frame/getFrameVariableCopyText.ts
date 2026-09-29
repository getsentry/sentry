import {t} from 'sentry/locale';
import type {NativeFrameVariable} from 'sentry/types/event';
import type {PlatformKey} from 'sentry/types/platform';

/** Copy scalar values as text or captured collections as JSON, using annotated display text. */
export function getFrameVariableCopyText(
  variable: NativeFrameVariable,
  platform: PlatformKey
): string {
  const value = getCopyValue(variable, platform);
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

function getCopyValue(variable: NativeFrameVariable, platform: PlatformKey): unknown {
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

  const hasValue = 'value' in variable && Boolean(variable.value);
  if (!hasValue && meta?.err?.length) {
    return `<${t('invalid')}>`;
  }
  if (!hasValue && meta?.rem?.length) {
    return `<${t('redacted')}>`;
  }

  switch (variable.kind) {
    case 'null':
      return platform === 'native' ? 'nullptr' : null;
    case 'unavailable':
      return t('Unavailable');
    case 'boolean':
      return variable.value === 'true';
    case 'number':
      return platform === 'native' ? variable.value : Number(variable.value);
    default:
      return variable.value;
  }
}
