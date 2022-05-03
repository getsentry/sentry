import React, {useState} from 'react';

import EventEntry from 'sentry/components/events/eventEntry';
import type {MemorySpanType} from 'sentry/components/events/interfaces/spans/types';
import TagsTable from 'sentry/components/tagsTable';
import type {BreadcrumbTypeConsole} from 'sentry/types/breadcrumbs';
import type {Event} from 'sentry/types/event';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useRouteContext} from 'sentry/utils/useRouteContext';

import {TabBarId} from '../types';

import Console from './console';
import FocusTabs from './focusTabs';
import MemoryChart from './memoryChart';

type Props = {
  consoleMessages: BreadcrumbTypeConsole[] | undefined;
  event: Event;
  eventWithSpans: Event | undefined;
  memorySpans: MemorySpanType[] | undefined;
};

const TABS = new Set(['console', 'performance', 'errors', 'tags', 'memory']);

function isTabBarId(tab: string): tab is TabBarId {
  return TABS.has(tab);
}

function FocusArea(props: Props) {
  const location = useLocation();
  const hash = location.hash.replace(/^#/, '');
  const tabFromHash = isTabBarId(hash) ? hash : 'performance';

  const [active, setActive] = useState<TabBarId>(tabFromHash);

  return (
    <React.Fragment>
      <FocusTabs active={active} setActive={setActive} />
      <ActiveTab active={active} {...props} />
    </React.Fragment>
  );
}

function ActiveTab({
  active,
  consoleMessages,
  event,
  eventWithSpans,
  memorySpans,
}: Props & {active: TabBarId}) {
  const {routes, router} = useRouteContext();
  const organization = useOrganization();
  switch (active) {
    case 'console':
      return (
        <div id="console">
          <Console consoleMessages={consoleMessages ?? []} />
        </div>
      );
    case 'performance':
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
      return (
        <MemoryChart
          memorySpans={memorySpans}
          startTimestamp={eventWithSpans?.entries[0]?.data[0]?.timestamp}
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
