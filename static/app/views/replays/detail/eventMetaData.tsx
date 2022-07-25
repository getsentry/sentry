import React from 'react';
import styled from '@emotion/styled';

import Duration from 'sentry/components/duration';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Placeholder from 'sentry/components/placeholder';
import TimeSince from 'sentry/components/timeSince';
import {IconCalendar, IconClock, IconFire} from 'sentry/icons';
import space from 'sentry/styles/space';
import type {Crumb} from 'sentry/types/breadcrumbs';
import type {EventTransaction} from 'sentry/types/event';
import {defined} from 'sentry/utils';
import useProjects from 'sentry/utils/useProjects';
import {useRouteContext} from 'sentry/utils/useRouteContext';

type Props = {
  crumbs: Crumb[] | undefined;
  duration: number | undefined;
  event: EventTransaction | undefined;
};

function EventMetaData({crumbs, duration, event}: Props) {
  const {
    params: {eventSlug},
  } = useRouteContext();
  const {projects} = useProjects();
  const errors = crumbs?.filter(crumb => crumb.type === 'error').length;

  const project = eventSlug.split(':')[0] || '';

  return (
    <KeyMetrics>
      <ProjectBadge
        project={
          projects.find(p => p.slug === project) || {
            slug: event?.projectSlug || '',
          }
        }
        avatarSize={16}
      />
      <KeyMetricData>
        {event ? (
          <React.Fragment>
            <IconCalendar color="gray300" />
            <TimeSince date={event.dateReceived} shorten />
          </React.Fragment>
        ) : (
          <HeaderPlaceholder />
        )}
      </KeyMetricData>
      <KeyMetricData>
        {duration !== undefined ? (
          <React.Fragment>
            <IconClock color="gray300" />
            <Duration
              seconds={Math.floor(msToSec(duration || 0)) || 1}
              abbreviation
              exact
            />
          </React.Fragment>
        ) : (
          <HeaderPlaceholder />
        )}
      </KeyMetricData>
      <KeyMetricData>
        {defined(errors) ? (
          <React.Fragment>
            <IconFire color="red300" />
            {errors}
          </React.Fragment>
        ) : (
          <HeaderPlaceholder />
        )}
      </KeyMetricData>
    </KeyMetrics>
  );
}

function msToSec(ms: number) {
  return ms / 1000;
}

export const HeaderPlaceholder = styled(function HeaderPlaceholder(
  props: React.ComponentProps<typeof Placeholder>
) {
  return <Placeholder width="80px" height="19px" {...props} />;
})`
  background-color: ${p => p.theme.background};
`;

const KeyMetrics = styled('div')`
  display: grid;
  gap: ${space(3)};
  grid-template-columns: repeat(4, max-content);
  align-items: center;
  justify-content: end;
  font-size: ${p => p.theme.fontSizeMedium};
`;

const KeyMetricData = styled('div')`
  color: ${p => p.theme.textColor};
  font-weight: normal;
  display: grid;
  grid-template-columns: repeat(2, max-content);
  align-items: center;
  gap: ${space(1)};
  line-height: ${p => p.theme.text.lineHeightBody};
`;

export default EventMetaData;
