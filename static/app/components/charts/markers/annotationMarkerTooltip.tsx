import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {
  formatAnnotationTime,
  summarizeAnnotation,
} from 'sentry/components/charts/annotations/summarizeAnnotation';
import type {AnnotationItem} from 'sentry/components/charts/annotations/types';
import {ChartBandTooltip} from 'sentry/components/charts/bands/chartBandTooltip';

interface AnnotationMarkerSectionProps {
  item: AnnotationItem;
  timezone: string;
}

function AnnotationMarkerSection({item, timezone}: AnnotationMarkerSectionProps) {
  const {heading, description, tag} = summarizeAnnotation(item);

  return (
    <Stack as="section" gap="xs" padding="lg xl">
      <Flex justify="between" align="center" gap="2xl">
        <Text bold>{heading}</Text>
        {tag}
      </Flex>
      {description ? <Text>{description}</Text> : null}
      <Text size="sm" variant="muted">
        {formatAnnotationTime(item, timezone)}
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
