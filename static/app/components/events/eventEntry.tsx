import Breadcrumbs from 'sentry/components/events/interfaces/breadcrumbs';
import {Csp} from 'sentry/components/events/interfaces/csp';
import DebugMeta from 'sentry/components/events/interfaces/debugMeta';
import Exception from 'sentry/components/events/interfaces/exception';
import ExceptionV2 from 'sentry/components/events/interfaces/exceptionV2';
import {Generic} from 'sentry/components/events/interfaces/generic';
import {Message} from 'sentry/components/events/interfaces/message';
import {PerformanceIssueSection} from 'sentry/components/events/interfaces/performance';
import {Request} from 'sentry/components/events/interfaces/request';
import Spans from 'sentry/components/events/interfaces/spans';
import StackTrace from 'sentry/components/events/interfaces/stackTrace';
import StackTraceV2 from 'sentry/components/events/interfaces/stackTraceV2';
import Template from 'sentry/components/events/interfaces/template';
import Threads from 'sentry/components/events/interfaces/threads';
import ThreadsV2 from 'sentry/components/events/interfaces/threadsV2';
import {Group, Organization, Project, SharedViewOrganization} from 'sentry/types';
import {Entry, EntryType, Event, EventError, EventTransaction} from 'sentry/types/event';

import {EmbeddedSpanTree} from './interfaces/spans/embeddedSpanTree';
import {FocusedSpanIDMap} from './interfaces/spans/types';

type Props = Pick<React.ComponentProps<typeof Breadcrumbs>, 'route' | 'router'> & {
  entry: Entry;
  event: Event;
  organization: SharedViewOrganization | Organization;
  projectSlug: Project['slug'];
  group?: Group;
};

function EventEntry({
  entry,
  projectSlug,
  event,
  organization,
  group,
  route,
  router,
}: Props) {
  const hasHierarchicalGrouping =
    !!organization.features?.includes('grouping-stacktrace-ui') &&
    !!(event.metadata.current_tree_label || event.metadata.finest_tree_label);

  const hasNativeStackTraceV2 = !!organization.features?.includes(
    'native-stack-trace-v2'
  );

  const groupingCurrentLevel = group?.metadata?.current_level;

  switch (entry.type) {
    case EntryType.EXCEPTION: {
      const {data, type} = entry;
      return hasNativeStackTraceV2 ? (
        <ExceptionV2
          type={type}
          event={event}
          data={data}
          projectId={projectSlug}
          groupingCurrentLevel={groupingCurrentLevel}
          hasHierarchicalGrouping={hasHierarchicalGrouping}
        />
      ) : (
        <Exception
          type={type}
          event={event}
          data={data}
          projectId={projectSlug}
          groupingCurrentLevel={groupingCurrentLevel}
          hasHierarchicalGrouping={hasHierarchicalGrouping}
        />
      );
    }
    case EntryType.MESSAGE: {
      return <Message event={event} data={entry.data} />;
    }
    case EntryType.REQUEST: {
      return <Request event={event} data={entry.data} />;
    }
    case EntryType.STACKTRACE: {
      const {data, type} = entry;
      return hasNativeStackTraceV2 ? (
        <StackTraceV2
          type={type}
          event={event}
          data={data}
          projectId={projectSlug}
          groupingCurrentLevel={groupingCurrentLevel}
          hasHierarchicalGrouping={hasHierarchicalGrouping}
        />
      ) : (
        <StackTrace
          type={type}
          event={event}
          data={data}
          projectId={projectSlug}
          groupingCurrentLevel={groupingCurrentLevel}
          hasHierarchicalGrouping={hasHierarchicalGrouping}
        />
      );
    }
    case EntryType.TEMPLATE: {
      const {data, type} = entry;
      return <Template type={type} event={event} data={data} />;
    }
    case EntryType.CSP: {
      const {data} = entry;
      return <Csp event={event} data={data} />;
    }
    case EntryType.EXPECTCT:
    case EntryType.EXPECTSTAPLE:
    case EntryType.HPKP: {
      const {data, type} = entry;
      return <Generic type={type} data={data} meta={event._meta?.hpkp ?? {}} />;
    }
    case EntryType.BREADCRUMBS: {
      const {data, type} = entry;
      return (
        <Breadcrumbs
          type={type}
          data={data}
          organization={organization as Organization}
          event={event}
          router={router}
          route={route}
        />
      );
    }
    case EntryType.THREADS: {
      const {data, type} = entry;
      return hasNativeStackTraceV2 ? (
        <ThreadsV2
          type={type}
          event={event}
          data={data}
          projectId={projectSlug}
          groupingCurrentLevel={groupingCurrentLevel}
          hasHierarchicalGrouping={hasHierarchicalGrouping}
        />
      ) : (
        <Threads
          type={type}
          event={event}
          data={data}
          projectId={projectSlug}
          groupingCurrentLevel={groupingCurrentLevel}
          hasHierarchicalGrouping={hasHierarchicalGrouping}
        />
      );
    }
    case EntryType.DEBUGMETA:
      const {data} = entry;

      return (
        <DebugMeta
          event={event}
          projectId={projectSlug}
          groupId={group?.id}
          organization={organization as Organization}
          data={data}
        />
      );
    case EntryType.SPANS:
      return (
        <Spans
          event={event as EventTransaction}
          organization={organization as Organization}
        />
      );
    case EntryType.SPANTREE:
      if (!organization.features?.includes('performance-extraneous-spans-poc')) {
        return null;
      }

      const {focusedSpanIds: _focusedSpanIds} = entry.data;

      const focusedSpanIds: FocusedSpanIDMap = {};
      _focusedSpanIds.forEach(spanId => (focusedSpanIds[spanId] = new Set()));

      // TODO: Need to dynamically determine the project slug for this issue
      const INTERNAL_PROJECT = 'sentry';

      return (
        <EmbeddedSpanTree
          event={event}
          organization={organization as Organization}
          projectSlug={INTERNAL_PROJECT}
          focusedSpanIds={focusedSpanIds}
        />
      );
    case EntryType.PERFORMANCE:
      if (!organization.features?.includes('performance-extraneous-spans-poc')) {
        return null;
      }

      return (
        <PerformanceIssueSection
          issue={group as Group}
          event={event as EventError}
          organization={organization as Organization}
        />
      );
    default:
      // this should not happen
      /* eslint no-console:0 */
      window.console &&
        console.error &&
        console.error('Unregistered interface: ' + (entry as any).type);
      return null;
  }
}

export default EventEntry;
