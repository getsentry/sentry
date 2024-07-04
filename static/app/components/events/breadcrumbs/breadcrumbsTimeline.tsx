import {Fragment} from 'react';
import styled from '@emotion/styled';

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
  fullyExpanded?: boolean;
  startTimeString?: TimelineItemProps['startTimeString'];
}

export default function BreadcrumbsTimeline({
  breadcrumbs,
  startTimeString,
  fullyExpanded = false,
}: BreadcrumbsTimelineProps) {
  if (!breadcrumbs.length) {
    return null;
  }

  const items = breadcrumbs.map(
    ({breadcrumb, raw, title, meta, iconComponent, colorConfig, levelComponent}, i) => {
      const isVirtualCrumb = !defined(raw);
      return (
        <Timeline.Item
          key={i}
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
          style={{background: 'transparent'}}
        >
          <BreadcrumbsItemContent
            breadcrumb={breadcrumb}
            meta={meta}
            fullyExpanded={fullyExpanded}
          />
        </Timeline.Item>
      );
    }
  );

  return <Timeline.Container>{items}</Timeline.Container>;
}

const Subtitle = styled('p')`
  margin: 0;
  font-weight: normal;
  font-size: ${p => p.theme.fontSizeSmall};
  display: inline;
`;
