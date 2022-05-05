import React from 'react';

import EventEntry from 'sentry/components/events/eventEntry';
import type {MemorySpanType} from 'sentry/components/events/interfaces/spans/types';
import TagsTable from 'sentry/components/tagsTable';
import type {Event} from 'sentry/types/event';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useRouteContext} from 'sentry/utils/useRouteContext';

import {isReplayTab, ReplayTabs} from '../types';

import FocusTabs from './focusTabs';
import IssueList from './issueList';
import MemoryChart from './memoryChart';

type Props = {
  event: Event;
  eventWithSpans: Event | undefined;
  memorySpans: MemorySpanType[] | undefined;
};

const DEFAULT_TAB = ReplayTabs.PERFORMANCE;

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

function ActiveTab({
  active,
  event,
  eventWithSpans,
  memorySpans,
}: Props & {active: ReplayTabs}) {
  const {routes, router} = useRouteContext();
  const organization = useOrganization();
  switch (active) {
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
