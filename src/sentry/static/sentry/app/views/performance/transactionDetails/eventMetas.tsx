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
import {MetaData} from './styles';
import {isTransaction} from './utils';

type Props = {
  event: Event;
  organization: OrganizationSummary;
  projectId: string;
  location: Location;
};

function EventMetas({event, organization, projectId, location}: Props) {
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
    <Container>
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
      <QuickTrace event={event} organization={organization} location={location} />
    </Container>
  );
}

const Container = styled('div')`
  display: grid;
  grid-column-gap: ${space(2)};
  grid-template-columns: repeat(3, 2fr);

  @media (min-width: ${p => p.theme.breakpoints[2]}) {
    grid-template-columns: repeat(3, 2fr) 5fr;
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
