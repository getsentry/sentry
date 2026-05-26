import type {ReactNode} from 'react';

import {InlineCode} from '@sentry/scraps/code';
import {InfoTip} from '@sentry/scraps/info';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {t, tct} from 'sentry/locale';

import {SpanCode} from './spanCode';
import type {LowValueSpanEvidenceData} from './types';
import {
  formatCount,
  formatDurationMs,
  formatEstimatedCostUsd,
  getSpanLabel,
} from './utils';

interface ProblemSectionProps {
  evidenceData: LowValueSpanEvidenceData;
}

function DetailRow({label, value}: {label: string; value: ReactNode}) {
  return (
    <Flex align="baseline" gap="sm" wrap="wrap">
      <Text variant="muted">{label}</Text>
      <Text>{value}</Text>
    </Flex>
  );
}

export function ProblemSection({evidenceData}: ProblemSectionProps) {
  const hasEstimatedCost =
    evidenceData.estimatedCostUsd !== null && evidenceData.estimatedCostUsd > 0;

  return (
    <Stack gap="lg" padding="lg">
      <Flex align="baseline" gap="sm" wrap="wrap">
        <Heading as="h3">{t('Problem')}</Heading>
        {evidenceData.op && <InlineCode>{evidenceData.op}</InlineCode>}
      </Flex>
      <Text>
        {t(
          'Sentry detected a span that appears frequently but adds low-value telemetry. It can make traces noisier and increase stored span volume without adding useful debugging context.'
        )}
      </Text>
      <Text>
        {tct('The affected span is [span].', {
          span: <SpanCode>{getSpanLabel(evidenceData)}</SpanCode>,
        })}
      </Text>
      <Stack gap="xs">
        <DetailRow label={t('Seen')} value={formatCount(evidenceData.count)} />
        {hasEstimatedCost && (
          <Flex align="baseline" gap="sm" wrap="wrap">
            <Flex align="center" gap="xs">
              <Text variant="muted">{t('Estimated cost')}</Text>
              <InfoTip
                size="xs"
                title={t(
                  "This is a rough approximation based on a snapshot of the customer's span data, not the whole billing period."
                )}
              />
            </Flex>
            <Text>{formatEstimatedCostUsd(evidenceData.estimatedCostUsd)}</Text>
          </Flex>
        )}
        <DetailRow
          label={t('Average duration')}
          value={formatDurationMs(evidenceData.avgDurationMs)}
        />
        {evidenceData.sdkName && (
          <DetailRow
            label={t('SDK')}
            value={<InlineCode>{evidenceData.sdkName}</InlineCode>}
          />
        )}
      </Stack>
    </Stack>
  );
}
