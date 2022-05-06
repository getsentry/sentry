import React from 'react';

import EventEntry from 'sentry/components/events/eventEntry';
import TagsTable from 'sentry/components/tagsTable';
import type {Entry, Event} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import ReplayReader from 'sentry/utils/replays/replayReader';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useRouteContext} from 'sentry/utils/useRouteContext';

import {isReplayTab, ReplayTabs} from '../types';

import Console from './console';
import FocusTabs from './focusTabs';
import IssueList from './issueList';
import MemoryChart from './memoryChart';

type Props = {
  replay: ReplayReader;
};

const DEFAULT_TAB = ReplayTabs.PERFORMANCE;

function getBreadcrumbsByCategory(breadcrumbEntry: Entry, categories: string[]) {
  return breadcrumbEntry.data.values.filter(breadcrumb =>
    categories.includes(breadcrumb.category)
  );
}

function FocusArea(props: Props) {
  const location = useLocation();
  const hash = location.hash.replace(/^#/, '');
  const tabFromHash = isReplayTab(hash) ? hash : DEFAULT_TAB;

  return (
    <React.Fragment>
      <FocusTabs active={tabFromHash} />
      <ActiveTab active={tabFromHash} {...props} />
    </React.Fragment>
  );
}

function ActiveTab({active, replay}: Props & {active: ReplayTabs}) {
  const {routes, router} = useRouteContext();
  const organization = useOrganization();

  const event = replay.getEvent();
  const spansEntry = replay.getEntryType(EntryType.SPANS);

  switch (active) {
    case 'console':
      const breadcrumbEntry = replay.getEntryType(EntryType.BREADCRUMBS);
      const consoleMessages = getBreadcrumbsByCategory(breadcrumbEntry, [
        'console',
        'error',
      ]);
      return (
        <div id="console">
          <Console consoleMessages={consoleMessages ?? []} />
        </div>
      );
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
    case 'issues':
      return (
        <div id="issues">
          <IssueList replayId={event.id} projectId={event.projectID} />
        </div>
      );
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
