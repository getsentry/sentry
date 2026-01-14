import ErrorBoundary from 'sentry/components/errorBoundary';
import {EventBreadcrumbsSection} from 'sentry/components/events/eventBreadcrumbsSection';
import {t} from 'sentry/locale';
import type {Entry, Event, EventTransaction} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Organization, SharedViewOrganization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {isJavascriptPlatform} from 'sentry/utils/platform';
import type {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';

import {Csp} from './interfaces/csp';
import {DebugMeta} from './interfaces/debugMeta';
import {Exception} from './interfaces/exception';
import {Generic} from './interfaces/generic';
import {Message} from './interfaces/message';
import {SpanEvidenceSection} from './interfaces/performance/spanEvidence';
import {Request} from './interfaces/request';
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
  sectionKey?: SectionKey;
};

function EventEntryContent({
  entry,
  projectSlug,
  event,
  organization,
  group,
  isShare,
}: Props) {
  const groupingCurrentLevel = group?.metadata?.current_level;
  const issueTypeConfig = group ? getConfigForIssueType(group, group.project) : null;

  switch (entry.type) {
    case EntryType.EXCEPTION:
      return (
        <Exception
          event={event}
          group={group}
          data={entry.data}
          projectSlug={projectSlug}
          groupingCurrentLevel={groupingCurrentLevel}
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
        />
      );

    case EntryType.TEMPLATE:
      return <Template event={event} data={entry.data} />;

    case EntryType.CSP:
      return <Csp event={event} data={entry.data} />;

    case EntryType.EXPECTCT:
    case EntryType.EXPECTSTAPLE: {
      const {data, type} = entry;
      return <Generic type={type} data={data} />;
    }
    case EntryType.HPKP:
      return (
        <Generic type={entry.type} data={entry.data} meta={event._meta?.hpkp ?? {}} />
      );

    case EntryType.BREADCRUMBS:
      return <EventBreadcrumbsSection event={event} />;

    case EntryType.THREADS:
      return (
        <Threads
          event={event}
          group={group}
          data={entry.data}
          projectSlug={projectSlug}
          groupingCurrentLevel={groupingCurrentLevel}
        />
      );

    case EntryType.DEBUGMETA:
      if (isShare || isJavascriptPlatform(event.platform)) {
        return null;
      }

      return (
        <DebugMeta
          event={event}
          projectSlug={projectSlug}
          groupId={group?.id}
          data={entry.data}
        />
      );

    case EntryType.SPANS:
      // XXX: We currently do not show spans in the share view.
      if (isShare || !issueTypeConfig?.spanEvidence.enabled) {
        return null;
      }

      return (
        <SpanEvidenceSection
          event={event as EventTransaction}
          organization={organization as Organization}
          projectSlug={projectSlug}
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
      customComponent={() => (
        <InterimSection type={props.entry.type} title={props.entry.type}>
          <p>{t('There was an error rendering this data.')}</p>
        </InterimSection>
      )}
    >
      <EventEntryContent {...props} />
    </ErrorBoundary>
  );
}
