import {Alert} from '@sentry/scraps/alert';
import {InfoTip} from '@sentry/scraps/info';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {
  KeyValueData,
  type KeyValueDataContentProps,
} from 'sentry/components/keyValueData';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils/defined';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useOrganization} from 'sentry/utils/useOrganization';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {getExploreUrl} from 'sentry/views/explore/utils';

import type {LowValueSpanEvidenceData} from './types';
import {formatDurationMs, formatEstimatedCostUsd, getSpanLabel} from './utils';

interface ProblemSectionProps {
  evidenceData: LowValueSpanEvidenceData;
}

const LOW_VALUE_SPAN_EXPLORE_REFERRER = 'low-value-span-configuration-issue';

function getAffectedSpanQuery(evidenceData: LowValueSpanEvidenceData): string | null {
  if (!evidenceData.op && !evidenceData.description) {
    return null;
  }

  return MutableSearch.fromQueryObject({
    'span.op': evidenceData.op ?? undefined,
    'span.description': evidenceData.description ?? undefined,
  }).formatString();
}

export function ProblemSection({evidenceData}: ProblemSectionProps) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const hasEstimatedCost =
    evidenceData.estimatedCostUsd !== null && evidenceData.estimatedCostUsd > 0;
  const spanCount = evidenceData.extrapolatedCount ?? evidenceData.count;
  const affectedSpanQuery = getAffectedSpanQuery(evidenceData);
  const affectedSpanExploreUrl = affectedSpanQuery
    ? getExploreUrl({
        organization,
        selection,
        mode: Mode.SAMPLES,
        query: affectedSpanQuery,
        referrer: LOW_VALUE_SPAN_EXPLORE_REFERRER,
      })
    : undefined;
  const contentItems: Array<KeyValueDataContentProps | null> = [
    {
      disableFormattedData: true,
      item: {
        action: affectedSpanExploreUrl ? {link: affectedSpanExploreUrl} : undefined,
        key: 'affected-span',
        subject: t('Affected span'),
        value: getSpanLabel(evidenceData),
      },
    },
    {
      disableFormattedData: true,
      item: {
        key: 'span-count',
        subject: t('Span count'),
        value: (
          <Flex align="center" gap="xs">
            <Text monospace>
              {spanCount === null ? t('Unknown') : formatAbbreviatedNumber(spanCount)}
            </Text>
            {evidenceData.extrapolatedCount !== null && (
              <InfoTip
                size="xs"
                title={t(
                  'This monthly volume is extrapolated from a recent sample of this span, so it may not match the final span volume for the billing period.'
                )}
              />
            )}
          </Flex>
        ),
      },
    },
    hasEstimatedCost
      ? {
          disableFormattedData: true,
          item: {
            key: 'estimated-cost',
            subject: t('Estimated cost'),
            value: (
              <Flex align="center" gap="xs">
                <Text monospace>
                  {formatEstimatedCostUsd(evidenceData.estimatedCostUsd)}
                </Text>
                <InfoTip
                  size="xs"
                  title={t(
                    'This estimate is based on a recent sample of this span, so it may not match your final bill for the billing period.'
                  )}
                />
              </Flex>
            ),
          },
        }
      : null,
    {
      disableFormattedData: true,
      item: {
        key: 'average-duration',
        subject: t('Average duration'),
        value: formatDurationMs(evidenceData.avgDurationMs),
      },
    },
  ];

  return (
    <Stack gap="lg">
      <Alert variant="muted" showIcon>
        {t(
          'Sentry found a frequently created span that adds little value. It can make traces harder to read and increase stored span volume.'
        )}
      </Alert>
      <Grid columns="fit-content(50%) 1fr" border="primary" radius="md" padding="sm">
        {contentItems.filter(defined).map(contentItem => (
          <KeyValueData.Content key={contentItem.item.key} {...contentItem} />
        ))}
      </Grid>
    </Stack>
  );
}
