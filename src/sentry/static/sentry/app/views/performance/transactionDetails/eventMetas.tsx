import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import DateTime from 'app/components/dateTime';
import ProjectBadge from 'app/components/idBadge/projectBadge';
import TimeSince from 'app/components/timeSince';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {OrganizationSummary} from 'app/types';
import {Event} from 'app/types/event';
import {getShortEventId} from 'app/utils/events';
import {getDuration} from 'app/utils/formatters';
import {QuickTraceQueryChildrenProps} from 'app/utils/performance/quickTrace/types';
import {isTransaction} from 'app/utils/performance/quickTrace/utils';
import Projects from 'app/utils/projects';

import QuickTraceMeta from './quickTraceMeta';
import {MetaData} from './styles';

type Props = Pick<
  React.ComponentProps<typeof QuickTraceMeta>,
  'errorDest' | 'transactionDest'
> & {
  event: Event;
  organization: OrganizationSummary;
  projectId: string;
  location: Location;
  quickTrace: QuickTraceQueryChildrenProps;
};

function EventMetas({
  event,
  organization,
  projectId,
  location,
  quickTrace,
  errorDest,
  transactionDest,
}: Props) {
  const type = isTransaction(event) ? 'transaction' : 'event';

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
    <EventDetailHeader type={type}>
      <MetaData
        headingText={t('Event ID')}
        tooltipText={t('The unique ID assigned to this %s.', type)}
        bodyText={getShortEventId(event.eventID)}
        subtext={projectBadge}
      />
      {isTransaction(event) ? (
        <MetaData
          headingText={t('Total Duration')}
          tooltipText={t(
            'The total time elapsed between the start and end of this transaction.'
          )}
          bodyText={getDuration(event.endTimestamp - event.startTimestamp, 2, true)}
          subtext={timestamp}
        />
      ) : (
        <MetaData
          headingText={t('Created')}
          tooltipText={t('The time at which this event was created.')}
          bodyText={timestamp}
          subtext={<DateTime date={event.dateCreated} />}
        />
      )}
      {isTransaction(event) && (
        <MetaData
          headingText={t('Status')}
          tooltipText={t(
            'The status of this transaction indicating if it succeeded or otherwise.'
          )}
          bodyText={event.contexts?.trace?.status ?? '\u2014'}
          subtext={httpStatus}
        />
      )}
      <QuickTraceContainer>
        <QuickTraceMeta
          event={event}
          organization={organization}
          location={location}
          quickTrace={quickTrace}
          errorDest={errorDest}
          transactionDest={transactionDest}
        />
      </QuickTraceContainer>
    </EventDetailHeader>
  );
}

const EventDetailHeader = styled('div')<{type?: 'transaction' | 'event'}>`
  display: grid;
  grid-template-columns: repeat(${p => (p.type === 'transaction' ? 3 : 2)}, 1fr);
  grid-template-rows: repeat(2, auto);
  grid-gap: ${space(2)};
  margin-bottom: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    margin-bottom: 0;
  }

  @media (min-width: ${p => p.theme.breakpoints[2]}) {
    ${p =>
      p.type === 'transaction'
        ? 'grid-template-columns: minmax(160px, 1fr) minmax(160px, 1fr) minmax(160px, 1fr) 6fr;'
        : 'grid-template-columns: minmax(160px, 1fr) minmax(200px, 1fr) 6fr;'};
    grid-row-gap: 0;
  }
`;

const QuickTraceContainer = styled('div')`
  grid-column: 1/4;

  @media (min-width: ${p => p.theme.breakpoints[2]}) {
    justify-self: flex-end;
    min-width: 325px;
    grid-column: unset;
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
