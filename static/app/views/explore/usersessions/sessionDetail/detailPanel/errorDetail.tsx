import {useQuery} from '@tanstack/react-query';

import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {EventContexts} from 'sentry/components/events/contexts';
import {HighlightsDataSection} from 'sentry/components/events/highlights/highlightsDataSection';
import {HighlightsIconSummary} from 'sentry/components/events/highlights/highlightsIconSummary';
import {LoadingError} from 'sentry/components/loadingError';
import {Placeholder} from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {EntryType, type EntryBreadcrumbs} from 'sentry/types/event';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjectFromId} from 'sentry/utils/useProjectFromId';
import type {SessionEvent} from 'sentry/views/explore/usersessions/sessionDetail/useSessionDetail';
import {groupEventApiOptions} from 'sentry/views/issueDetails/utils';
import {TraceDrawerComponents} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/styles';
import {BreadCrumbs} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/transaction/sections/breadCrumbs';
import {Entries} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/transaction/sections/entries';
import {Request} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/transaction/sections/request';

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

/** `project.id` comes back numeric; the project store keys projects by it. */
function projectIdOf(value: unknown): string {
  return typeof value === 'number' || typeof value === 'string' ? String(value) : '';
}

/**
 * An error event, shown with the trace waterfall's own event sections.
 *
 * Errors are the one telemetry type here that is not an EAP trace item —
 * `SupportedTraceItemType` has no `errors` member — so they can't share the
 * attribute-tree path the other three take. What they can share is everything the
 * waterfall's drawer shows for an event it has selected: the same highlights, the
 * same stack trace, the same tags, contexts, breadcrumbs and request. A session
 * error is usually read for its breadcrumbs as much as its stack, and those are
 * exactly the sections that were missing.
 *
 * The issue this belongs to still has a page of its own, which the panel header's
 * "Open Issue" button leads to.
 */
export function ErrorDetail({event}: {event: SessionEvent}) {
  const organization = useOrganization();
  const project = useProjectFromId({project_id: projectIdOf(event.row['project.id'])});

  const rawGroupId = event.row['issue.id'];
  const groupId =
    typeof rawGroupId === 'number' || typeof rawGroupId === 'string'
      ? String(rawGroupId)
      : undefined;
  const eventId = str(event.row.id);

  const {
    data: eventData,
    isPending,
    isError,
  } = useQuery({
    ...groupEventApiOptions({
      orgSlug: organization.slug,
      groupId: groupId ?? '',
      eventId: eventId ?? '',
      // The panel addresses one specific event, so the environment filter that
      // narrows "which event of this issue" has nothing left to decide.
      environments: [],
    }),
    enabled: Boolean(groupId && eventId),
    retry: false,
  });

  if (!groupId || !eventId) {
    return (
      <Text size="sm" variant="muted">
        {t('No further details are available for this error.')}
      </Text>
    );
  }

  if (isPending) {
    return (
      <Stack gap="md">
        <Placeholder height="16px" width="60%" />
        <Placeholder height="200px" />
      </Stack>
    );
  }

  if (isError || !eventData) {
    return <LoadingError message={t('Failed to load this error event.')} />;
  }

  // Serialized entries are positional, and an entry's `_meta` is keyed by that
  // position rather than by its type.
  const breadcrumbIndex = eventData.entries.findIndex(
    entry => entry.type === EntryType.BREADCRUMBS
  );
  const breadcrumbs = (eventData.entries[breadcrumbIndex] as EntryBreadcrumbs | undefined)
    ?.data;
  const breadcrumbMeta = eventData._meta?.entries?.[breadcrumbIndex]?.data?.values;

  const projectSlug = eventData.projectSlug ?? project?.slug;

  return (
    <Stack gap="md" minWidth="0">
      <ErrorBoundary mini>
        <HighlightsIconSummary event={eventData} />
      </ErrorBoundary>

      {project && <HighlightsDataSection event={eventData} project={project} />}

      {/* The exception, message or thread the event carries — the stack trace among
          them, rendered the way the issue page renders it. */}
      {projectSlug && <Entries definedEvent={eventData} projectSlug={projectSlug} />}

      {projectSlug && (
        <TraceDrawerComponents.EventTags event={eventData} projectSlug={projectSlug} />
      )}

      <EventContexts event={eventData} disableCollapsePersistence />

      {/* What the user did before the error, which for a session error is often
          the point of opening it at all. */}
      {breadcrumbs && <BreadCrumbs breadcrumbs={breadcrumbs} meta={breadcrumbMeta} />}

      {/* Renders nothing when the event carries no request interface. */}
      <Request event={eventData} />
    </Stack>
  );
}
