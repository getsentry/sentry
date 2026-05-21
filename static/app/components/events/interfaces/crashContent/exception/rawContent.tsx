import {Fragment} from 'react';
import {useQuery} from '@tanstack/react-query';

import {ClippedBox} from 'sentry/components/clippedBox';
import {displayRawContent as rawStacktraceContent} from 'sentry/components/events/interfaces/crashContent/stackTrace/rawContent';
import {LoadingError} from 'sentry/components/loadingError';
import {Placeholder} from 'sentry/components/placeholder';
import type {Event, ExceptionType} from 'sentry/types/event';
import type {PlatformKey, Project} from 'sentry/types/project';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

interface Props {
  eventId: Event['id'];
  platform: PlatformKey | undefined;
  projectSlug: Project['slug'];
  threadId: number | undefined;
  type: 'original' | 'minified';
  values: ExceptionType['values'];
}

const appleCrashReportPlatforms: PlatformKey[] = [
  'native',
  'cocoa',
  'nintendo-switch',
  'playstation',
  'xbox',
];

export function RawContent({
  eventId,
  projectSlug,
  type,
  platform,
  values,
  threadId,
}: Props) {
  const organization = useOrganization();

  const isNative = !!platform && appleCrashReportPlatforms.includes(platform);

  const {
    data: crashReport,
    isPending,
    isError,
  } = useQuery({
    ...apiOptions.as<string>()(
      // Note that this endpoint does not have a trailing slash for some reason
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/events/$eventId/apple-crash-report',
      {
        path: {
          organizationIdOrSlug: organization.slug,
          projectIdOrSlug: projectSlug,
          eventId,
        },
        query: {
          minified: String(type === 'minified'),
          ...(threadId !== undefined && {thread_id: String(threadId)}),
        },
        headers: {Accept: '*/*; charset=utf-8'},
        staleTime: Infinity,
      }
    ),
    enabled: isNative,
  });

  if (isPending && isNative) {
    return <Placeholder height="270px" />;
  }

  if (isError) {
    return <LoadingError />;
  }

  if (!values) {
    return null;
  }

  return (
    <Fragment>
      {values.map((exc, excIdx) => {
        if (!isNative) {
          const exceptionValue =
            type === 'original' ? exc.value : exc.rawValue || exc.value;
          const exceptionType = type === 'original' ? exc.type : exc.rawType || exc.type;

          const nonNativeContent = exc.stacktrace ? (
            rawStacktraceContent({
              data: type === 'original' ? exc.stacktrace : exc.rawStacktrace,
              platform,
              exception: exc,
              isMinified: type === 'minified',
            })
          ) : (
            <div>
              {exceptionType}: {exceptionValue}
            </div>
          );
          return (
            <div key={excIdx} data-test-id="raw-stack-trace">
              <pre className="traceback plain">{nonNativeContent}</pre>
            </div>
          );
        }

        return (
          <div key={excIdx} data-test-id="raw-stack-trace">
            <pre className="traceback plain">
              <ClippedBox clipHeight={250}>{crashReport}</ClippedBox>
            </pre>
          </div>
        );
      })}
    </Fragment>
  );
}
