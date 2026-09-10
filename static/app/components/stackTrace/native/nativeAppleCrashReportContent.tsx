import {useQuery} from '@tanstack/react-query';

import {ClippedBox} from 'sentry/components/clippedBox';
import {LoadingError} from 'sentry/components/loadingError';
import {Placeholder} from 'sentry/components/placeholder';
import {RawStackTraceText} from 'sentry/components/stackTrace/rawStackTrace';
import {useStackTraceViewState} from 'sentry/components/stackTrace/stackTraceContext';
import type {Event} from 'sentry/types/event';
import type {Project} from 'sentry/types/project';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

interface NativeAppleCrashReportContentProps {
  eventId: Event['id'];
  projectSlug: Project['slug'];
  threadId?: number;
}

export function NativeAppleCrashReportContent({
  eventId,
  projectSlug,
  threadId,
}: NativeAppleCrashReportContentProps) {
  const organization = useOrganization();
  const {isMinified} = useStackTraceViewState();

  const {
    data: crashReport,
    isPending,
    isError,
  } = useQuery({
    ...apiOptions.as<string>()(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/events/$eventId/apple-crash-report',
      {
        path: {
          organizationIdOrSlug: organization.slug,
          projectIdOrSlug: projectSlug,
          eventId,
        },
        query: {
          minified: String(isMinified),
          ...(threadId !== undefined && {thread_id: String(threadId)}),
        },
        headers: {Accept: '*/*; charset=utf-8'},
        staleTime: Infinity,
      }
    ),
  });

  if (isPending) {
    return <Placeholder height="270px" />;
  }

  if (isError) {
    return <LoadingError />;
  }

  return (
    <RawStackTraceText data-test-id="raw-stack-trace">
      <ClippedBox clipHeight={250}>{crashReport}</ClippedBox>
    </RawStackTraceText>
  );
}
