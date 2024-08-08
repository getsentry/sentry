import {useRef} from 'react';
import styled from '@emotion/styled';
import {useVirtualizer} from '@tanstack/react-virtual';
import moment from 'moment-timezone';

import DateTime from 'sentry/components/dateTime';
import Duration from 'sentry/components/duration';
import BreadcrumbItemContent from 'sentry/components/events/breadcrumbs/breadcrumbItemContent';
import type {EnhancedCrumb} from 'sentry/components/events/breadcrumbs/utils';
import Timeline from 'sentry/components/timeline';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import isValidDate from 'sentry/utils/date/isValidDate';
import {shouldUse24Hours} from 'sentry/utils/dates';

interface BreadcrumbsTimelineProps {
  breadcrumbs: EnhancedCrumb[];
  /**
   * If true, expands the contents of the breadcrumbs' data payload
   */
  fullyExpanded?: boolean;
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
  fullyExpanded = true,
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
      <BreadcrumbItem
        key={virtualizedRow.key}
        ref={virtualizer.measureElement}
        title={
          <Header>
            <div>
              <TextBreak>{title}</TextBreak>
              {isVirtualCrumb && <Subtitle> - {t('This event')}</Subtitle>}
            </div>
            {levelComponent}
          </Header>
        }
        colorConfig={colorConfig}
        icon={iconComponent}
        timestamp={timestampComponent}
        // XXX: Only the virtual crumb can be marked as active for breadcrumbs
        isActive={isVirtualCrumb ?? false}
        data-index={virtualizedRow.index}
        showLastLine={showLastLine}
      >
        <ContentWrapper>
          <BreadcrumbItemContent
            breadcrumb={breadcrumb}
            meta={meta}
            fullyExpanded={fullyExpanded}
          />
        </ContentWrapper>
      </BreadcrumbItem>
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

const Header = styled('div')`
  display: grid;
  grid-template-columns: 1fr auto;
`;

const TextBreak = styled('span')`
  word-wrap: break-word;
  word-break: break-all;
`;

const Subtitle = styled('p')`
  margin: 0;
  font-weight: normal;
  font-size: ${p => p.theme.fontSizeSmall};
  display: inline;
`;

const Timestamp = styled('div')`
  margin-right: ${p => p.theme.space(1)};
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
  span {
    text-decoration: underline dashed ${p => p.theme.translucentBorder};
  }
`;

const ContentWrapper = styled('div')`
  padding-bottom: ${p => p.theme.space(1)};
`;

const BreadcrumbItem = styled(Timeline.Item)`
  border-bottom: 1px solid transparent;
  &:not(:last-child) {
    border-image: linear-gradient(
        to right,
        transparent 20px,
        ${p => p.theme.translucentInnerBorder} 20px
      )
      100% 1;
  }
`;
