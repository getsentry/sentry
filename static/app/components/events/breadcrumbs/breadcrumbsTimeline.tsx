import {
  BREADCRUMB_TIMESTAMP_PLACEHOLDER,
  BreadcrumbIcon,
  getBreadcrumbColorConfig,
  getBreadcrumbTitle,
} from 'sentry/components/events/breadcrumbs/utils';
import {convertCrumbType} from 'sentry/components/events/interfaces/breadcrumbs/utils';
import {StructuredData} from 'sentry/components/structuredEventData';
import Timeline, {type TimelineItemProps} from 'sentry/components/timeline';
import type {RawCrumb} from 'sentry/types/breadcrumbs';
import {defined} from 'sentry/utils';

interface BreadcrumbsTimelineProps {
  breadcrumbs: RawCrumb[];
  fullyExpanded?: boolean;
  meta?: Record<string, any>;
  startTimeString?: TimelineItemProps['startTimeString'];
  virtualCrumbIndex?: number;
}

export default function BreadcrumbsTimeline({
  breadcrumbs,
  startTimeString,
  virtualCrumbIndex,
  meta = {},
  fullyExpanded = false,
}: BreadcrumbsTimelineProps) {
  if (!breadcrumbs.length) {
    return null;
  }

  const items = breadcrumbs.map((breadcrumb, i) => {
    const bc = convertCrumbType(breadcrumb);
    const bcMeta = meta[i];
    const isVirtualCrumb = defined(virtualCrumbIndex) && i === virtualCrumbIndex;
    const defaultDepth = fullyExpanded ? 10000 : 1;
    return (
      <Timeline.Item
        key={i}
        title={getBreadcrumbTitle(bc.category)}
        colorConfig={getBreadcrumbColorConfig(bc.type)}
        icon={<BreadcrumbIcon type={bc.type} />}
        timeString={bc.timestamp ?? BREADCRUMB_TIMESTAMP_PLACEHOLDER}
        startTimeString={startTimeString}
        // XXX: Only the virtual crumb can be marked as active for breadcrumbs
        isActive={isVirtualCrumb ?? false}
        style={{background: 'transparent'}}
      >
        {defined(bc.message) && (
          <Timeline.Text>
            <StructuredData
              value={bc.message}
              depth={0}
              maxDefaultDepth={defaultDepth}
              meta={bcMeta?.message}
              withAnnotatedText
              withOnlyFormattedText
            />
          </Timeline.Text>
        )}
        {defined(bc.data) && (
          <Timeline.Data>
            <StructuredData
              value={bc.data}
              depth={0}
              maxDefaultDepth={defaultDepth}
              meta={bcMeta?.data}
              withAnnotatedText
              withOnlyFormattedText
            />
          </Timeline.Data>
        )}
      </Timeline.Item>
    );
  });

  return <Timeline.Container>{items}</Timeline.Container>;
}
