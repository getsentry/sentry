import ErrorBoundary from 'sentry/components/errorBoundary';
import {EventDataSection} from 'sentry/components/events/eventDataSection';
import {t} from 'sentry/locale';
import {
  Group,
  IssueCategory,
  Organization,
  Project,
  SharedViewOrganization,
} from 'sentry/types';
import {Entry, EntryType, Event, EventTransaction} from 'sentry/types/event';

import {Breadcrumbs} from './interfaces/breadcrumbs';
import {Csp} from './interfaces/csp';
import {DebugMeta} from './interfaces/debugMeta';
import {Exception} from './interfaces/exception';
import {Generic} from './interfaces/generic';
import {Message} from './interfaces/message';
import {SpanEvidenceSection} from './interfaces/performance/spanEvidence';
import {Request} from './interfaces/request';
import {Spans} from './interfaces/spans';
import {StackTrace} from './interfaces/stackTrace';
import {Template} from './interfaces/template';
import {Threads} from './interfaces/threads';

type Props = {
  entry: Entry;
  event: Event;
  organization: SharedViewOrganization | Organization;
  projectSlug: Project['slug'];
  group?: Group;
  isShare?: boolean;
};

function EventEntryContent({
  entry,
  projectSlug,
  event,
  organization,
  group,
  isShare,
}: Props) {
  const hasHierarchicalGrouping =
    !!organization.features?.includes('grouping-stacktrace-ui') &&
    !!(event.metadata.current_tree_label || event.metadata.finest_tree_label);

  const groupingCurrentLevel = group?.metadata?.current_level;

  switch (entry.type) {
    case EntryType.EXCEPTION:
      return (
        <Exception
          event={event}
          data={entry.data}
          projectSlug={projectSlug}
          groupingCurrentLevel={groupingCurrentLevel}
          hasHierarchicalGrouping={hasHierarchicalGrouping}
        />
      );

    case EntryType.MESSAGE:
      return <Message event={event} data={entry.data} />;

    case EntryType.REQUEST:
      return <Request event={event} data={entry.data} />;

    case EntryType.STACKTRACE:
      return (
        <StackTrace
          event={event}
          data={entry.data}
          projectSlug={projectSlug}
          groupingCurrentLevel={groupingCurrentLevel}
          hasHierarchicalGrouping={hasHierarchicalGrouping}
        />
      );

    case EntryType.TEMPLATE:
      return <Template event={event} data={entry.data} />;

    case EntryType.CSP:
      return <Csp event={event} data={entry.data} />;

    case EntryType.EXPECTCT:
    case EntryType.EXPECTSTAPLE:
      const {data, type} = entry;
      return <Generic type={type} data={data} />;

    case EntryType.HPKP:
      return (
        <Generic type={entry.type} data={entry.data} meta={event._meta?.hpkp ?? {}} />
      );

    case EntryType.BREADCRUMBS:
      return (
        <Breadcrumbs
          data={entry.data}
          organization={organization as Organization}
          event={event}
        />
      );

    case EntryType.THREADS:
      return (
        <Threads
          event={event}
          data={entry.data}
          projectSlug={projectSlug}
          groupingCurrentLevel={groupingCurrentLevel}
          hasHierarchicalGrouping={hasHierarchicalGrouping}
          organization={organization as Organization}
        />
      );

    case EntryType.DEBUGMETA:
      return (
        <DebugMeta
          event={event}
          projectSlug={projectSlug}
          groupId={group?.id}
          organization={organization as Organization}
          data={entry.data}
        />
      );

    case EntryType.SPANS:
      // XXX: We currently do not show spans in the share view,
      if (isShare) {
        return null;
      }
      if (group?.issueCategory === IssueCategory.PERFORMANCE) {
        return (
          <SpanEvidenceSection
            event={event as EventTransaction}
            organization={organization as Organization}
            projectSlug={projectSlug}
          />
        );
      }
      return (
        <Spans
          event={event as EventTransaction}
          organization={organization as Organization}
        />
      );

    // this should not happen
    default:
      if (window.console) {
        // eslint-disable-next-line no-console
        console.error?.('Unregistered interface: ' + (entry as any).type);
      }
      return null;
  }
}

export function EventEntry(props: Props) {
  return (
    <ErrorBoundary
      customComponent={
        <EventDataSection type={props.entry.type} title={props.entry.type}>
          <p>{t('There was an error rendering this data.')}</p>
        </EventDataSection>
      }
    >
      <EventEntryContent {...props} />
    </ErrorBoundary>
  );
}
