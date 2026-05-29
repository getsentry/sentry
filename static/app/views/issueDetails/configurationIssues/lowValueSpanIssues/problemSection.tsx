import type {ReactNode} from 'react';

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
  const spanCount = evidenceData.extrapolatedCount ?? evidenceData.spanCount;

  return (
    <Stack gap="lg" padding="lg">
      <Flex align="baseline" gap="sm" wrap="wrap">
        <Heading as="h3">{t('Problem')}</Heading>
      </Flex>
      <Text>
        {t(
          'Sentry found a frequently created span that adds little value. It can make traces harder to read and increase stored span volume.'
        )}
      </Text>
      <Text>
        {tct('The affected span is [span].', {
          span: <SpanCode>{getSpanLabel(evidenceData)}</SpanCode>,
        })}
      </Text>
      <Stack gap="xs">
        <Flex align="baseline" gap="sm" wrap="wrap">
          <Text variant="muted">{t('Span count')}</Text>
          <Flex align="center" gap="xs">
            <Text>{formatCount(spanCount)}</Text>
            {evidenceData.extrapolatedCount !== null && (
              <InfoTip
                size="xs"
                title={t(
                  'This monthly volume is extrapolated from a recent sample of this span, so it may not match the final span volume for the billing period.'
                )}
              />
            )}
          </Flex>
        </Flex>
        {hasEstimatedCost && (
          <Flex align="baseline" gap="sm" wrap="wrap">
            <Text variant="muted">{t('Estimated cost')}</Text>
            <Flex align="center" gap="xs">
              <Text>{formatEstimatedCostUsd(evidenceData.estimatedCostUsd)}</Text>
              <InfoTip
                size="xs"
                title={t(
                  'This estimate is based on a recent sample of this span, so it may not match your final bill for the billing period.'
                )}
              />
            </Flex>
          </Flex>
        )}
        <DetailRow
          label={t('Average duration')}
          value={formatDurationMs(evidenceData.avgDurationMs)}
        />
      </Stack>
    </Stack>
  );
}
