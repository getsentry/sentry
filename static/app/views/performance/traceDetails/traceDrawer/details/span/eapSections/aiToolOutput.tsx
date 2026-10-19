import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t, tn} from 'sentry/locale';
import {TraceDrawerComponents} from 'sentry/views/performance/traceDetails/traceDrawer/details/styles';

export function AIToolOutput({value}: {value: unknown}) {
  let output: unknown = value;
  if (typeof value === 'string') {
    try {
      output = JSON.parse(value);
    } catch {
      // Unstructured tool results are plain text, not markdown.
    }
  }

  if (output === undefined) {
    return <Text variant="muted">{t('No output for this span')}</Text>;
  }

  const structured = output !== null && typeof output === 'object' ? output : null;
  const label = Array.isArray(output)
    ? tn('Array · %s item', 'Array · %s items', output.length)
    : structured
      ? tn('Object · %s field', 'Object · %s fields', Object.keys(structured).length)
      : output === null
        ? t('Null')
        : typeof output === 'boolean'
          ? t('Boolean')
          : typeof output === 'number'
            ? t('Number')
            : t('Text');

  return (
    <Stack gap="sm" minWidth="0">
      <Text size="sm" variant="muted">
        {label}
      </Text>
      {structured ? (
        <TraceDrawerComponents.MultilineJSON
          value={structured}
          maxDefaultDepth={3}
          autoCollapseLimit={100_000}
          mode="pretty"
        />
      ) : output === null || output === '' ? (
        <Text variant="muted">
          {output === null ? t('Returned null') : t('Empty string')}
        </Text>
      ) : (
        <TraceDrawerComponents.MultilineText mode="raw" clip={false}>
          {typeof output === 'string' ? output : (JSON.stringify(output) ?? '')}
        </TraceDrawerComponents.MultilineText>
      )}
    </Stack>
  );
}
