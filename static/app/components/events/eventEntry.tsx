import Breadcrumbs from 'sentry/components/events/interfaces/breadcrumbs';
import {Csp} from 'sentry/components/events/interfaces/csp';
import {DebugMeta} from 'sentry/components/events/interfaces/debugMeta';
import Exception from 'sentry/components/events/interfaces/exception';
import ExceptionV2 from 'sentry/components/events/interfaces/exceptionV2';
import {Generic} from 'sentry/components/events/interfaces/generic';
import {Message} from 'sentry/components/events/interfaces/message';
import {
  SpanEvidence,
  SpanEvidenceSection,
} from 'sentry/components/events/interfaces/performance';
import {Request} from 'sentry/components/events/interfaces/request';
import Spans from 'sentry/components/events/interfaces/spans';
import StackTrace from 'sentry/components/events/interfaces/stackTrace';
import StackTraceV2 from 'sentry/components/events/interfaces/stackTraceV2';
import {Template} from 'sentry/components/events/interfaces/template';
import Threads from 'sentry/components/events/interfaces/threads';
import ThreadsV2 from 'sentry/components/events/interfaces/threadsV2';
import {
  Group,
  IssueCategory,
  Organization,
  Project,
  SharedViewOrganization,
} from 'sentry/types';
import {Entry, EntryType, Event, EventTransaction} from 'sentry/types/event';

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
      return hasNativeStackTraceV2 ? (
        <ExceptionV2
          event={event}
          data={entry.data}
          projectId={projectSlug}
          groupingCurrentLevel={groupingCurrentLevel}
          hasHierarchicalGrouping={hasHierarchicalGrouping}
        />
      ) : (
        <Exception
          event={event}
          data={entry.data}
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
      return hasNativeStackTraceV2 ? (
        <StackTraceV2
          event={event}
          data={entry.data}
          projectId={projectSlug}
          groupingCurrentLevel={groupingCurrentLevel}
          hasHierarchicalGrouping={hasHierarchicalGrouping}
        />
      ) : (
        <StackTrace
          event={event}
          data={entry.data}
          projectId={projectSlug}
          groupingCurrentLevel={groupingCurrentLevel}
          hasHierarchicalGrouping={hasHierarchicalGrouping}
        />
      );
    }
    case EntryType.TEMPLATE: {
      return <Template event={event} data={entry.data} />;
    }
    case EntryType.CSP: {
      return <Csp event={event} data={entry.data} />;
    }
    case EntryType.EXPECTCT:
    case EntryType.EXPECTSTAPLE: {
      const {data, type} = entry;
      return <Generic type={type} data={data} />;
    }
    case EntryType.HPKP:
      return (
        <Generic type={entry.type} data={entry.data} meta={event._meta?.hpkp ?? {}} />
      );

    case EntryType.BREADCRUMBS: {
      return (
        <Breadcrumbs
          data={entry.data}
          organization={organization as Organization}
          event={event}
          router={router}
          route={route}
        />
      );
    }
    case EntryType.THREADS: {
      return hasNativeStackTraceV2 ? (
        <ThreadsV2
          event={event}
          data={entry.data}
          projectId={projectSlug}
          groupingCurrentLevel={groupingCurrentLevel}
          hasHierarchicalGrouping={hasHierarchicalGrouping}
        />
      ) : (
        <Threads
          event={event}
          data={entry.data}
          projectId={projectSlug}
          groupingCurrentLevel={groupingCurrentLevel}
          hasHierarchicalGrouping={hasHierarchicalGrouping}
        />
      );
    }
    case EntryType.DEBUGMETA:
      return (
        <DebugMeta
          event={event}
          projectId={projectSlug}
          groupId={group?.id}
          organization={organization as Organization}
          data={entry.data}
        />
      );
    case EntryType.SPANS:
      if (
        group?.issueCategory === IssueCategory.PERFORMANCE &&
        organization?.features?.includes('performance-issues')
      ) {
        // TODO: Replace this with real data from the entry when possible
        const SAMPLE_SPAN_EVIDENCE: SpanEvidence = {
          transaction: '/api/transaction/00',
          parentSpan: 'index',
          sourceSpan:
            'SELECT "sentry_useroption"."id", "sentry_useroption"."user_id", "sentry_useroption"."project_id", "sentry_useroption"."organization_id", "sentry_useroption"."key", "sentry_useroption"."value" FROM "sentry_useroption" WHERE ("sentry_useroption"."organization_id" IS NULL AND "sentry_useroption"."project_id" IS NULL AND "sentry_useroption"."user_id" = %s) ',
          repeatingSpan:
            'SELECT "sentry_project"."id", "sentry_project"."slug", "sentry_project"."name", "sentry_project"."forced_color", "sentry_project"."organization_id", "sentry_project"."public", "sentry_project"."date_added", "sentry_project"."status", "sentry_project"."first_event", "sentry_project"."flags", "sentry_project"."platform" FROM "sentry_project" WHERE ("sentry_project"."organization_id" = %s AND "sentry_project"."status" = %s AND "sentry_project"."id" IN (%s))',
        };

        return (
          <SpanEvidenceSection
            event={event}
            organization={organization as Organization}
            spanEvidence={SAMPLE_SPAN_EVIDENCE}
            affectedSpanIds={[]}
          />
        );
      }

      return (
        <Spans
          event={event as EventTransaction}
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
