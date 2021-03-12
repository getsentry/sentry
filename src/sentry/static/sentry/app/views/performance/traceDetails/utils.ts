import {LocationDescriptor, Query} from 'history';

import {OrganizationSummary} from 'app/types';
import {reduceTrace} from 'app/utils/performance/quickTrace/utils';

import {TraceInfo} from './types';

export function getTraceDetailsUrl(
  organization: OrganizationSummary,
  traceSlug: string,
  start: string,
  end: string,
  query: Query
): LocationDescriptor {
  return {
    pathname: `/organizations/${organization.slug}/performance/trace/${traceSlug}/`,
    query: {...query, start, end},
  };
}

function traceVisitor() {
  const projectIds = new Set();
  const eventIds = new Set();

  return (accumulator, event) => {
    if (!projectIds.has(event.project_id)) {
      projectIds.add(event.project_id);
      accumulator.totalProjects += 1;

      // No user conditions yet, so all projects are relevant.
      accumulator.relevantProjects += 1;
    }

    if (!eventIds.has(event.event_id)) {
      eventIds.add(event.event_id);
      accumulator.totalTransactions += 1;

      // No user conditions yet, so all transactions are relevant.
      accumulator.relevantTransactions += 1;
    }
    return accumulator;
  };
}

export function getTraceInfo(trace) {
  return reduceTrace<TraceInfo>(trace, traceVisitor(), {
    totalProjects: 0,
    relevantProjects: 0,
    totalTransactions: 0,
    relevantTransactions: 0,
  });
}

export {toPercent} from 'app/components/events/interfaces/spans/utils';
