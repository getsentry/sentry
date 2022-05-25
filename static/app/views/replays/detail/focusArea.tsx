import {useMemo} from 'react';

import EventEntry from 'sentry/components/events/eventEntry';
import Placeholder from 'sentry/components/placeholder';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import TagsTable from 'sentry/components/tagsTable';
import type {Entry, Event} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import useActiveTabFromLocation from 'sentry/utils/replays/hooks/useActiveTabFromLocation';
import ReplayReader from 'sentry/utils/replays/replayReader';
import useOrganization from 'sentry/utils/useOrganization';
import {useRouteContext} from 'sentry/utils/useRouteContext';

import Console from './console';
import IssueList from './issueList';
import MemoryChart from './memoryChart';
import Trace from './trace';

type Props = {
  replay: ReplayReader | null;
};

function getBreadcrumbsByCategory(breadcrumbEntry: Entry, categories: string[]) {
  return breadcrumbEntry.data.values.filter(breadcrumb =>
    categories.includes(breadcrumb.category)
  );
}

function FocusArea({replay}: Props) {
  const active = useActiveTabFromLocation();
  const {routes, router} = useRouteContext();
  const {currentTime, currentHoverTime, setCurrentTime, setCurrentHoverTime} =
    useReplayContext();
  const organization = useOrganization();

  // Memoize this because re-renders will interfere with the mouse state of the
  // chart (e.g. on mouse over and out)
  const memorySpans = useMemo(() => {
    return replay?.getRawSpans().filter(replay.isMemorySpan);
  }, [replay]);

  if (!replay || !memorySpans) {
    return <Placeholder height="150px" />;
  }

  const event = replay.getEvent();
  const spansEntry = replay.getEntryType(EntryType.SPANS);

  switch (active) {
    case 'console':
      const breadcrumbEntry = replay?.getEntryType(EntryType.BREADCRUMBS);
      const consoleMessages = getBreadcrumbsByCategory(breadcrumbEntry, [
        'console',
        'error',
      ]);
      return (
        <Console
          breadcrumbs={consoleMessages ?? []}
          startTimestamp={event?.startTimestamp}
        />
      );
    case 'performance': {
      const nonMemorySpansEntry = {
        ...spansEntry,
        data: spansEntry.data.filter(replay.isNotMemorySpan),
      };
      const performanceEvent = {
        ...event,
        entries: [nonMemorySpansEntry],
      } as Event;
      return (
        <EventEntry
          projectSlug={getProjectSlug(performanceEvent)}
          // group={group}
          organization={organization}
          event={performanceEvent}
          entry={nonMemorySpansEntry}
          route={routes[routes.length - 1]}
          router={router}
        />
      );
    }
    case 'trace':
      return <Trace organization={organization} event={event} />;
    case 'issues':
      return <IssueList replayId={event.id} projectId={event.projectID} />;
    case 'tags':
      return <TagsTable generateUrl={() => ''} event={event} query="" />;
    case 'memory':
      return (
        <MemoryChart
          currentTime={currentTime}
          currentHoverTime={currentHoverTime}
          memorySpans={memorySpans}
          setCurrentTime={setCurrentTime}
          setCurrentHoverTime={setCurrentHoverTime}
          startTimestamp={event?.startTimestamp}
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
