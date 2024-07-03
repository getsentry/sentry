import {Fragment} from 'react';
import styled from '@emotion/styled';

import BreadcrumbsItemContent from 'sentry/components/events/breadcrumbs/breadcrumbsItemContent';
import {
  BREADCRUMB_TIMESTAMP_PLACEHOLDER,
  BreadcrumbIcon,
  BreadcrumbTag,
  getBreadcrumbColorConfig,
  getBreadcrumbTitle,
} from 'sentry/components/events/breadcrumbs/utils';
import Timeline, {type TimelineItemProps} from 'sentry/components/timeline';
import {t} from 'sentry/locale';
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

  const items = breadcrumbs.map((bc, i) => {
    const bcMeta = meta[i];
    const isVirtualCrumb = defined(virtualCrumbIndex) && i === virtualCrumbIndex;
    return (
      <Timeline.Item
        key={i}
        title={
          <Fragment>
            {getBreadcrumbTitle(bc.category)}
            {isVirtualCrumb && <Subtitle> - {t('This event')}</Subtitle>}
            <BreadcrumbTag level={bc.level} />
          </Fragment>
        }
        colorConfig={getBreadcrumbColorConfig(bc.type)}
        icon={<BreadcrumbIcon type={bc.type} />}
        timeString={bc.timestamp ?? BREADCRUMB_TIMESTAMP_PLACEHOLDER}
        startTimeString={startTimeString}
        // XXX: Only the virtual crumb can be marked as active for breadcrumbs
        isActive={isVirtualCrumb ?? false}
        style={{background: 'transparent'}}
      >
        <BreadcrumbsItemContent
          breadcrumb={bc}
          meta={bcMeta}
          fullyExpanded={fullyExpanded}
        />
      </Timeline.Item>
    );
  });

  return <Timeline.Container>{items}</Timeline.Container>;
}

const Subtitle = styled('p')`
  margin: 0;
  font-weight: normal;
  font-size: ${p => p.theme.fontSizeSmall};
  display: inline;
`;
