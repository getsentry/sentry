import React, {useState} from 'react';

import EventEntry from 'sentry/components/events/eventEntry';
import TagsTable from 'sentry/components/tagsTable';
import {EntryType, Event} from 'sentry/types/event';
import ReplayReader from 'sentry/utils/replays/replayReader';
import useOrganization from 'sentry/utils/useOrganization';
import {useRouteContext} from 'sentry/utils/useRouteContext';

import {TabBarId} from '../types';

import FocusTabs from './focusTabs';
import MemoryChart from './memoryChart';

type Props = {
  replay: ReplayReader;
};

function FocusArea(props: Props) {
  const [active, setActive] = useState<TabBarId>('performance');

  return (
    <React.Fragment>
      <FocusTabs active={active} setActive={setActive} />
      <ActiveTab active={active} {...props} />
    </React.Fragment>
  );
}

function ActiveTab({active, replay}: Props & {active: TabBarId}) {
  const {routes, router} = useRouteContext();
  const organization = useOrganization();

  const event = replay.getEvent();
  const spansEntry = replay.getEntryType(EntryType.SPANS);

  switch (active) {
    case 'console':
      return <div id="console">TODO: Add a console view</div>;
    case 'performance': {
      if (!spansEntry) {
        return null;
      }
      const nonMemorySpans = {
        ...spansEntry,
        data: spansEntry.data.filter(replay.isNotMemorySpan),
      };
      const performanceEvent = {
        ...event,
        entries: [nonMemorySpans],
      } as Event;
      return (
        <div id="performance">
          <EventEntry
            projectSlug={getProjectSlug(performanceEvent)}
            // group={group}
            organization={organization}
            event={performanceEvent}
            entry={nonMemorySpans}
            route={routes[routes.length - 1]}
            router={router}
          />
        </div>
      );
    }
    case 'errors':
      return <div id="errors">TODO: Add an errors view</div>;
    case 'tags':
      return (
        <div id="tags">
          <TagsTable generateUrl={() => ''} event={event} query="" />
        </div>
      );
    case 'memory':
      return (
        <MemoryChart
          memorySpans={spansEntry?.data.filter(replay.isMemorySpan)}
          startTimestamp={event.startTimestamp}
        />
      );
    default:
      return null;
  }
}

function getProjectSlug(event: Event) {
  return event.projectSlug || event['project.name']; // seems janky
}

export default FocusArea;
