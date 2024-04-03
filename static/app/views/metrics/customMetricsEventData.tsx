import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/button';
import {EventDataSection} from 'sentry/components/events/eventDataSection';
import KeyValueList from 'sentry/components/events/interfaces/keyValueList';
import type {
  MetricsSummary,
  MetricsSummaryItem,
} from 'sentry/components/events/interfaces/spans/types';
import Link from 'sentry/components/links/link';
import {normalizeDateTimeString} from 'sentry/components/organizations/pageFilters/parse';
import Pill from 'sentry/components/pill';
import Pills from 'sentry/components/pills';
import TextOverflow from 'sentry/components/textOverflow';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {MRI, Organization} from 'sentry/types';
import {getDefaultMetricOp, getMetricsUrl} from 'sentry/utils/metrics';
import {hasCustomMetrics} from 'sentry/utils/metrics/features';
import {
  formatMetricUsingUnit,
  getReadableMetricType,
} from 'sentry/utils/metrics/formatters';
import {formatMRI, parseMRI} from 'sentry/utils/metrics/mri';
import {MetricDisplayType} from 'sentry/utils/metrics/types';
import useOrganization from 'sentry/utils/useOrganization';

function flattenMetricsSummary(
  metricsSummary: MetricsSummary
): {item: MetricsSummaryItem; key: string; mri: MRI}[] {
  return (
    Object.entries(metricsSummary) as [
      keyof MetricsSummary,
      MetricsSummary[keyof MetricsSummary],
    ][]
  ).flatMap(([mri, items]) =>
    (items || []).map((item, index) => ({item, mri, key: `${mri}${index}`}))
  );
}

function tagToQuery(tagKey: string, tagValue: string) {
  return `${tagKey}:"${tagValue}"`;
}

const HALF_HOUR_IN_MS = 30 * 60 * 1000;

export function CustomMetricsEventData({
  metricsSummary,
  startTimestamp,
}: {
  startTimestamp: number;
  metricsSummary?: MetricsSummary;
}) {
  const organization = useOrganization();
  const metricsSummaryEntries = metricsSummary
    ? flattenMetricsSummary(metricsSummary)
    : [];
  const widgetStart = new Date(startTimestamp * 1000 - HALF_HOUR_IN_MS);
  const widgetEnd = new Date(startTimestamp * 1000 + HALF_HOUR_IN_MS);

  if (!hasCustomMetrics(organization) || metricsSummaryEntries.length === 0) {
    return null;
  }

  return (
    <EventDataSection type="custom-metrics" title={t('Emitted Metrics')}>
      {metricsSummaryEntries.map(({mri, item, key}) => {
        return (
          <Fragment key={key}>
            <KeyValueList
              shouldSort={false}
              data={[
                {
                  key: 'name',
                  subject: t('Name'),
                  value: <TextOverflow>{formatMRI(mri)}</TextOverflow>,
                  actionButton: (
                    <LinkButton
                      size="xs"
                      to={getMetricsUrl(organization.slug, {
                        start: normalizeDateTimeString(widgetStart),
                        end: normalizeDateTimeString(widgetEnd),
                        widgets: [
                          {
                            mri,
                            displayType: MetricDisplayType.LINE,
                            op: getDefaultMetricOp(mri),
                            query: Object.entries(item.tags ?? {})
                              .map(([tagKey, tagValue]) => tagToQuery(tagKey, tagValue))
                              .join(' '),
                          },
                        ],
                      })}
                    >
                      {t('Open in Metrics')}
                    </LinkButton>
                  ),
                },
                {
                  key: 'stats',
                  subject: t('Stats'),
                  value: <MetricStats item={item} mri={mri} />,
                },
                item.tags && Object.keys(item.tags).length > 0
                  ? {
                      key: 'tags',
                      subject: t('Tags'),
                      value: (
                        <Tags tags={item.tags} organization={organization} mri={mri} />
                      ),
                    }
                  : null,
              ].filter((row): row is Exclude<typeof row, null> => Boolean(row))}
            />
          </Fragment>
        );
      })}
    </EventDataSection>
  );
}

function MetricStats({mri, item}: {item: MetricsSummaryItem; mri: MRI}) {
  const parsedMRI = parseMRI(mri);
  const unit = parsedMRI?.unit ?? 'none';
  const type = parsedMRI?.type ?? 'c';

  const typeLine = t(`Type: %s`, getReadableMetricType(type));
  // We use formatMetricUsingUnit with unit 'none' to ensure uniform number formatting
  const countLine = t(`Count: %s`, formatMetricUsingUnit(item.count, 'none'));

  // For counters the other stats offer little value, so we only show type and count
  if (type === 'c' || !item.count) {
    return (
      <pre>
        {typeLine}
        <br />
        {countLine}
      </pre>
    );
  }

  // If there is only one value, min, max, avg and sum are all the same
  if (item.count <= 1) {
    return (
      <pre>
        {typeLine}
        <br />
        {t('Value: %s', formatMetricUsingUnit(item.sum, unit))}
      </pre>
    );
  }

  return (
    <pre>
      {typeLine}
      <br />
      {countLine}
      <br />
      {t('Sum: %s', formatMetricUsingUnit(item.sum, unit))}
      <br />
      {t('Min: %s', formatMetricUsingUnit(item.min, unit))}
      <br />
      {t('Max: %s', formatMetricUsingUnit(item.max, unit))}
      <br />
      {t(
        'Avg: %s',
        formatMetricUsingUnit(item.sum && item.count && item.sum / item.count, unit)
      )}
    </pre>
  );
}

function Tags({
  tags,
  organization,
  mri,
}: {
  mri: MRI;
  organization: Organization;
  tags: Record<string, string>;
}) {
  const [showingAll, setShowingAll] = useState(false);

  const renderedTags = Object.entries(tags).slice(0, showingAll ? undefined : 5);
  const renderText = showingAll ? t('Show less') : t('Show more') + '...';

  return (
    <StyledPills>
      {renderedTags.map(([tagKey, tagValue]) => (
        <StyledPill key={tagKey} name={tagKey}>
          <Link
            to={getMetricsUrl(organization.slug, {
              widgets: [
                {
                  mri,
                  displayType: MetricDisplayType.LINE,
                  op: getDefaultMetricOp(mri),
                  query: tagToQuery(tagKey, tagValue),
                },
              ],
            })}
          >
            {tagValue}
          </Link>
        </StyledPill>
      ))}
      {Object.entries(tags).length > 5 && (
        <ShowMore onClick={() => setShowingAll(prev => !prev)}>{renderText}</ShowMore>
      )}
    </StyledPills>
  );
}

const StyledPills = styled(Pills)`
  padding-top: ${space(1)};
`;

const StyledPill = styled(Pill)`
  width: min-content;
`;

const ShowMore = styled('a')`
  white-space: nowrap;
  align-self: center;
  margin-bottom: ${space(1)};
  padding: ${space(0.5)} ${space(0.5)};
`;
