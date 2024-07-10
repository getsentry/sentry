import {Fragment, useRef} from 'react';
import styled from '@emotion/styled';
import {useVirtualizer} from '@tanstack/react-virtual';
import moment from 'moment';

import DateTime from 'sentry/components/dateTime';
import Duration from 'sentry/components/duration';
import BreadcrumbsItemContent from 'sentry/components/events/breadcrumbs/breadcrumbsItemContent';
import type {EnhancedCrumb} from 'sentry/components/events/breadcrumbs/utils';
import Timeline from 'sentry/components/timeline';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import isValidDate from 'sentry/utils/date/isValidDate';
import {shouldUse24Hours} from 'sentry/utils/dates';

interface BreadcrumbsTimelineProps {
  breadcrumbs: EnhancedCrumb[];
  /**
   * If false, expands the contents of the breadcrumb's data payload, adds padding.
   */
  isCompact?: boolean;
  /**
   * Shows the line after the last breadcrumbs icon.
   * Useful for connecting timeline to components rendered after it.
   */
  showLastLine?: boolean;
  /**
   * If specified, will display time relatively.
   */
  startTimeString?: string;
}

export default function BreadcrumbsTimeline({
  breadcrumbs,
  startTimeString,
  isCompact = false,
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

    const timeDate = new Date(breadcrumb.timestamp ?? '');
    const startTimeDate = new Date(startTimeString ?? '');

    const absoluteFormat = shouldUse24Hours() ? 'HH:mm:ss.SSS' : 'hh:mm:ss.SSS';
    const timestampComponent = isValidDate(timeDate) ? (
      <Timestamp>
        <Tooltip
          title={<DateTime date={timeDate} format={`ll - ${absoluteFormat} (z)`} />}
        >
          {isValidDate(startTimeDate) ? (
            <Duration
              seconds={moment(timeDate).diff(moment(startTimeDate), 's', true)}
              exact
              abbreviation
            />
          ) : (
            <DateTime date={timeDate} format={absoluteFormat} />
          )}
        </Tooltip>
      </Timestamp>
    ) : null;

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
        timestamp={timestampComponent}
        // XXX: Only the virtual crumb can be marked as active for breadcrumbs
        isActive={isVirtualCrumb ?? false}
        style={showLastLine ? {background: 'transparent'} : {}}
        data-index={virtualizedRow.index}
      >
        <ContentWrapper isCompact={isCompact}>
          <BreadcrumbsItemContent
            breadcrumb={breadcrumb}
            meta={meta}
            fullyExpanded={!isCompact}
          />
        </ContentWrapper>
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

const Timestamp = styled('div')`
  margin: 0 ${space(1)};
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
  span {
    text-decoration: underline dashed ${p => p.theme.translucentBorder};
  }
`;

const ContentWrapper = styled('div')<{isCompact: boolean}>`
  padding-bottom: ${p => space(p.isCompact ? 0.5 : 1.5)};
`;
