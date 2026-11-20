import {Tag} from '@sentry/scraps/badge';
import {formatDateTime} from '@sentry/scraps/dateTime';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import type {TagVariant} from '@sentry/scraps/theme';

import {
  TIMESERIES_ANNOTATION_TYPE_LABELS,
  type TimeseriesAnnotation,
} from 'sentry/components/charts/annotations/timeseriesAnnotation';
import type {AnnotationItem} from 'sentry/components/charts/annotations/types';
import {
  ChartBandTooltip,
  formatTimeRange,
} from 'sentry/components/charts/bands/chartBandTooltip';
import {getFlagActionLabel} from 'sentry/components/featureFlags/utils';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils/defined';
import {getExactDuration} from 'sentry/utils/duration/getExactDuration';

const SEVERITY_TAGS: Record<
  TimeseriesAnnotation['severity'],
  {label: string; variant: TagVariant}
> = {
  low: {label: t('Low'), variant: 'muted'},
  medium: {label: t('Medium'), variant: 'warning'},
  high: {label: t('High'), variant: 'danger'},
};

function formatItemTime({start, end}: AnnotationItem, timezone: string): string {
  const startTime = formatDateTime(start, {timezone, showTimezone: true});
  if (end === 'ongoing') {
    return t('%s - Ongoing', startTime);
  }
  if (defined(end) && end > start) {
    return `${formatTimeRange(start, end, timezone)} (${getExactDuration((end - start) / 1000)})`;
  }
  return startTime;
}

interface ItemSummary {
  heading: string;
  description?: string;
  tag?: React.ReactNode;
}

function summarizeItem(item: AnnotationItem): ItemSummary {
  switch (item.kind) {
    case 'timeseriesAnnotation': {
      const severity = item.severity ? SEVERITY_TAGS[item.severity] : undefined;
      return {
        heading: item.annotationType
          ? TIMESERIES_ANNOTATION_TYPE_LABELS[item.annotationType]
          : t('Change'),
        description: item.title,
        tag: severity ? <Tag variant={severity.variant}>{severity.label}</Tag> : null,
      };
    }
    case 'release':
      return {heading: t('Release'), description: item.title};
    case 'flag':
      return {
        heading: item.title,
        tag: item.action ? getFlagActionLabel(item.action) : null,
      };
  }
}

interface AnnotationMarkerSectionProps {
  item: AnnotationItem;
  timezone: string;
}

function AnnotationMarkerSection({item, timezone}: AnnotationMarkerSectionProps) {
  const {heading, description, tag} = summarizeItem(item);

  return (
    <Stack as="section" gap="xs" padding="lg xl">
      <Flex justify="between" align="center" gap="2xl">
        <Text bold>{heading}</Text>
        {tag}
      </Flex>
      {description ? <Text>{description}</Text> : null}
      <Text size="sm" variant="muted">
        {formatItemTime(item, timezone)}
      </Text>
    </Stack>
  );
}

interface AnnotationMarkerTooltipProps {
  items: readonly AnnotationItem[];
  timezone: string;
}

/**
 * One section per annotation that shares the hovered marker, each with its
 * own time.
 */
export function AnnotationMarkerTooltip({items, timezone}: AnnotationMarkerTooltipProps) {
  return (
    <ChartBandTooltip
      sections={items.map(item => (
        <AnnotationMarkerSection key={item.id} item={item} timezone={timezone} />
      ))}
      timezone={timezone}
    />
  );
}
