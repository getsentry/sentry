import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {StructuredData} from 'sentry/components/structuredEventData';
import {getDefaultExpanded} from 'sentry/components/structuredEventData/utils';
import {t, tn} from 'sentry/locale';

import {parseToolOutput, type ToolOutputData} from './toolOutputData';

const MAX_DEFAULT_DEPTH = 3;
const AUTO_COLLAPSE_LIMIT = 100_000;
const STRUCTURED_DATA_CONFIG = {
  isString: (value: unknown) => typeof value === 'string',
  isBoolean: (value: unknown) => typeof value === 'boolean',
  isNumber: (value: unknown) => typeof value === 'number',
};

function getOutputLabel(output: ToolOutputData): string {
  switch (output.kind) {
    case 'array':
      return tn('Array (%s item)', 'Array (%s items)', output.value.length);
    case 'object':
      return tn(
        'Object (%s field)',
        'Object (%s fields)',
        Object.keys(output.value).length
      );
    case 'null':
      return t('Null');
    case 'boolean':
      return t('Boolean');
    case 'number':
      return t('Number');
    case 'text':
      return t('Text');
    case 'missing':
      return t('No output for this span');
  }
}

function ToolOutputContent({output}: {output: ToolOutputData}) {
  switch (output.kind) {
    case 'array':
    case 'object':
      return (
        <Text as="div" size="sm" monospace>
          <StructuredData
            value={output.value}
            config={STRUCTURED_DATA_CONFIG}
            maxDefaultDepth={MAX_DEFAULT_DEPTH}
            autoCollapseLimit={AUTO_COLLAPSE_LIMIT}
            initialExpandedPaths={[
              '$',
              ...getDefaultExpanded(MAX_DEFAULT_DEPTH, output.value, AUTO_COLLAPSE_LIMIT),
            ]}
            withAnnotatedText
          />
        </Text>
      );
    case 'null':
      return <Text variant="muted">{t('Returned null')}</Text>;
    case 'text':
      if (output.value === '') {
        return <Text variant="muted">{t('Empty string')}</Text>;
      }
      return (
        <Text as="div" wrap="pre-wrap" wordBreak="break-word">
          {output.value}
        </Text>
      );
    case 'number':
    case 'boolean':
      return (
        <Text as="div" monospace>
          {String(output.value)}
        </Text>
      );
    case 'missing':
      return null;
  }
}

export function ToolOutput({value}: {value: unknown}) {
  const output = parseToolOutput(value);
  const label = getOutputLabel(output);
  if (output.kind === 'missing') {
    return <Text variant="muted">{label}</Text>;
  }
  const copyText =
    typeof output.value === 'string'
      ? output.value
      : JSON.stringify(output.value, null, 2);

  return (
    <Stack gap="sm" minWidth="0">
      <Flex align="center" justify="between" gap="sm">
        <Text size="sm" variant="muted">
          {label}
        </Text>
        <CopyToClipboardButton
          text={copyText}
          aria-label={t('Copy output')}
          size="xs"
          variant="transparent"
        />
      </Flex>
      <Container
        background="secondary"
        radius="md"
        padding="md"
        minWidth="0"
        overflow="auto"
      >
        <ToolOutputContent output={output} />
      </Container>
    </Stack>
  );
}
