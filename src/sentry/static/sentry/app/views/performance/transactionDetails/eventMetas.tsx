import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import ProjectBadge from 'app/components/idBadge/projectBadge';
import TimeSince from 'app/components/timeSince';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {OrganizationSummary} from 'app/types';
import {Event} from 'app/types/event';
import {getShortEventId} from 'app/utils/events';
import {getDuration} from 'app/utils/formatters';
import Projects from 'app/utils/projects';

import QuickTrace from './quickTrace';
import {QuickTraceQueryChildrenProps} from './quickTraceQuery';
import {MetaData} from './styles';
import {isTransaction} from './utils';

type Props = {
  event: Event;
  organization: OrganizationSummary;
  projectId: string;
  location: Location;
  quickTrace: QuickTraceQueryChildrenProps;
};

function EventMetas({event, organization, projectId, location, quickTrace}: Props) {
  if (!isTransaction(event)) {
    return null;
  }

  const projectBadge = (
    <Projects orgId={organization.slug} slugs={[projectId]}>
      {({projects}) => {
        const project = projects.find(p => p.slug === projectId);
        return (
          <ProjectBadge project={project ? project : {slug: projectId}} avatarSize={16} />
        );
      }}
    </Projects>
  );

  const timestamp = (
    <TimeSince date={event.dateCreated || (event.endTimestamp || 0) * 1000} />
  );

  const httpStatus = <HttpStatus event={event} />;

  return (
    <EventDetailHeader>
      <MetaData
        headingText={t('Event ID')}
        tooltipText={t('The unique ID assigned to this transaction.')}
        bodyText={getShortEventId(event.eventID)}
        subtext={projectBadge}
      />
      <MetaData
        headingText={t('Total Duration')}
        tooltipText={t(
          'The total time elapsed between the start and end of this transaction.'
        )}
        bodyText={getDuration(event.endTimestamp - event.startTimestamp, 2, true)}
        subtext={timestamp}
      />
      <MetaData
        headingText={t('Status')}
        tooltipText={t(
          'The status of this transaction indicating if it succeeded or otherwise.'
        )}
        bodyText={event.contexts?.trace?.status ?? '\u2014'}
        subtext={httpStatus}
      />
      <QuickTrace
        event={event}
        organization={organization}
        location={location}
        quickTrace={quickTrace}
      />
    </EventDetailHeader>
  );
}

const EventDetailHeader = styled('div')`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(2, auto);
  grid-gap: ${space(2)};
  margin-bottom: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    grid-template-columns: minmax(150px, 2fr) minmax(150px, 2fr) minmax(150px, 2fr) 4fr;
    grid-row-gap: 0;
    margin-bottom: 0;
  }
`;

function HttpStatus({event}: {event: Event}) {
  const {tags} = event;

  const emptyStatus = <React.Fragment>{'\u2014'}</React.Fragment>;

  if (!Array.isArray(tags)) {
    return emptyStatus;
  }

  const tag = tags.find(tagObject => tagObject.key === 'http.status_code');

  if (!tag) {
    return emptyStatus;
  }

  return <React.Fragment>HTTP {tag.value}</React.Fragment>;
}

export default EventMetas;
