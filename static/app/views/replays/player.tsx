import styled from '@emotion/styled';

import RRWebIntegration from 'sentry/components/events/rrwebIntegration';
import * as Layout from 'sentry/components/layouts/thirds';
import type {Event} from 'sentry/types/event';
import useEvent from 'sentry/utils/replays/hooks/useEvent';
import {useRouteContext} from 'sentry/utils/useRouteContext';

type ComponentProps = {
  event: Event;
  orgId: string;
  projectId: string;
};

function Player() {
  const {
    params: {eventSlug, orgId},
  } = useRouteContext();
  const [projectId, _] = eventSlug.split(':');

  const {data: event} = useEvent<Event>({orgId, eventSlug});

  if (!event) {
    return <div>Loading Integrations...</div>;
  }

  return (
    <Layout.Body>
      <OrigRRWeb event={event} orgId={orgId} projectId={projectId} />
      <NewRRweb event={event} orgId={orgId} projectId={projectId} />
    </Layout.Body>
  );
}

function OrigRRWeb({event, orgId, projectId}: ComponentProps) {
  return (
    <Layout.Main>
      <EventDataSection>
        <RRWebIntegration
          event={event}
          orgId={orgId}
          projectId={projectId}
          renderer={children => children}
        />
      </EventDataSection>
    </Layout.Main>
  );
}

const EventDataSection = styled('div')`
  overflow: hidden;

  display: flex;
  flex-direction: column;
  border-top: 1px solid ${p => p.theme.innerBorder};
  margin: 0;

  position: relative;
`;

function NewRRweb({event, orgId, projectId}: ComponentProps) {
  return (
    <Layout.Main>
      <EventDataSection>
        <RRWebIntegration
          replayVersion
          event={event}
          orgId={orgId}
          projectId={projectId}
          renderer={children => children}
        />
      </EventDataSection>
    </Layout.Main>
  );
}

export default Player;
