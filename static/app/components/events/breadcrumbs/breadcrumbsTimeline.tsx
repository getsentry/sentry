import {Fragment, useRef} from 'react';
import styled from '@emotion/styled';
import {useVirtualizer} from '@tanstack/react-virtual';

import BreadcrumbsItemContent from 'sentry/components/events/breadcrumbs/breadcrumbsItemContent';
import {
  BREADCRUMB_TIMESTAMP_PLACEHOLDER,
  type EnhancedCrumb,
} from 'sentry/components/events/breadcrumbs/utils';
import Timeline, {type TimelineItemProps} from 'sentry/components/timeline';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';

interface BreadcrumbsTimelineProps {
  breadcrumbs: EnhancedCrumb[];
  /**
   * Fully expands the contents of the breadcrumb's data payload.
   */
  fullyExpanded?: boolean;
  /**
   * Shows the line after the last breadcrumbs icon.
   * Useful for connecting timeline to components rendered after it.
   */
  showLastLine?: boolean;
  startTimeString?: TimelineItemProps['startTimeString'];
}

export default function BreadcrumbsTimeline({
  breadcrumbs,
  startTimeString,
  fullyExpanded = false,
  showLastLine = false,
}: BreadcrumbsTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: breadcrumbs.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 35,
    // Must match rendered item margins.
    gap: 8,
    overscan: 10,
  });

  if (!breadcrumbs.length) {
    return null;
  }

  const virtualItems = virtualizer.getVirtualItems();
  const items = virtualItems.map(virtualizedRow => {
    const {breadcrumb, raw, title, meta, iconComponent, colorConfig, levelComponent} =
      breadcrumbs[virtualizedRow.index];
    const isVirtualCrumb = !defined(raw);
    return (
      <Timeline.Item
        key={virtualizedRow.key}
        ref={virtualizer.measureElement}
        title={
          <Fragment>
            {title}
            {isVirtualCrumb && <Subtitle> - {t('This event')}</Subtitle>}
            {levelComponent}
          </Fragment>
        }
        colorConfig={colorConfig}
        icon={iconComponent}
        timeString={breadcrumb.timestamp ?? BREADCRUMB_TIMESTAMP_PLACEHOLDER}
        startTimeString={startTimeString}
        // XXX: Only the virtual crumb can be marked as active for breadcrumbs
        isActive={isVirtualCrumb ?? false}
        style={showLastLine ? {background: 'transparent'} : {}}
        data-index={virtualizedRow.index}
      >
        <BreadcrumbsItemContent
          breadcrumb={breadcrumb}
          meta={meta}
          fullyExpanded={fullyExpanded}
        />
      </Timeline.Item>
    );
  });

  return (
    <div
      ref={containerRef}
      style={{
        height: virtualizer.getTotalSize(),

        contain: 'layout size',
      }}
    >
      <Timeline.Container>{items}</Timeline.Container>
    </div>
  );
}

const Subtitle = styled('p')`
  margin: 0;
  font-weight: normal;
  font-size: ${p => p.theme.fontSizeSmall};
  display: inline;
`;
