import React, {useState} from 'react';

import EventEntry from 'sentry/components/events/eventEntry';
import TagsTable from 'sentry/components/tagsTable';
import {Event} from 'sentry/types/event';
import useOrganization from 'sentry/utils/useOrganization';
import {useRouteContext} from 'sentry/utils/useRouteContext';

import {TabBarId} from '../types';

import FocusButtons from './focusButtons';

type Props = {
  event: Event;
  eventWithSpans: Event | undefined;
};

function FocusArea(props: Props) {
  const [active, setActive] = useState<TabBarId>('performance');

  return (
    <React.Fragment>
      <FocusButtons active={active} setActive={setActive} />
      <ActiveTab active={active} {...props} />
    </React.Fragment>
  );
}

function ActiveTab({active, event, eventWithSpans}: Props & {active: TabBarId}) {
  const {routes, router} = useRouteContext();
  const organization = useOrganization();

  switch (active) {
    case 'console':
      return null;
    case 'performance':
      return eventWithSpans ? (
        <EventEntry
          key={`${eventWithSpans.id}`}
          projectSlug={getProjectSlug(eventWithSpans)}
          // group={group}
          organization={organization}
          event={eventWithSpans}
          entry={eventWithSpans.entries[0]}
          route={routes[routes.length - 1]}
          router={router}
        />
      ) : null;
    case 'errors':
      return null;
    case 'tags':
      return <TagsTable generateUrl={() => ''} event={event} query="" />;
    default:
      return null;
  }
}

function getProjectSlug(event: Event) {
  return event.projectSlug || event['project.name']; // seems janky
}

export default FocusArea;
