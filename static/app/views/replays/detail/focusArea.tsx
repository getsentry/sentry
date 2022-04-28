import React, {useMemo, useState} from 'react';

import EventEntry from 'sentry/components/events/eventEntry';
import TagsTable from 'sentry/components/tagsTable';
import {Event} from 'sentry/types/event';
import useOrganization from 'sentry/utils/useOrganization';
import {useRouteContext} from 'sentry/utils/useRouteContext';

import {TabBarId} from '../types';

import FocusButtons from './focusButtons';
import MemoryChart from './memoryChart';

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
  // memoize the memory events coming from the event because we reassign
  // the data without the memory events within the 'performance' case
  const memorySpans = useMemo(
    () => eventWithSpans?.entries[0]?.data?.filter(datum => datum?.data?.memory) || [],
    [eventWithSpans?.entries[0]]
  );
  switch (active) {
    case 'console':
      return <div id="console">TODO: Add a console view</div>;
    case 'performance':
      if (eventWithSpans) {
        eventWithSpans.entries[0].data = eventWithSpans?.entries[0]?.data?.filter(
          datum => !datum?.data?.memory
        );
      }
      return eventWithSpans ? (
        <div id="performance">
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
        </div>
      ) : null;
    case 'errors':
      return <div id="errors">TODO: Add an errors view</div>;
    case 'tags':
      return (
        <div id="tags">
          <TagsTable generateUrl={() => ''} event={event} query="" />
        </div>
      );
    case 'memory':
      return <MemoryChart memorySpans={memorySpans} />;
    default:
      return null;
  }
}

function getProjectSlug(event: Event) {
  return event.projectSlug || event['project.name']; // seems janky
}

export default FocusArea;
