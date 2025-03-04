import {Fragment} from 'react';

import ClippedBox from 'sentry/components/clippedBox';
import rawStacktraceContent from 'sentry/components/events/interfaces/crashContent/stackTrace/rawContent';
import LoadingError from 'sentry/components/loadingError';
import Placeholder from 'sentry/components/placeholder';
import type {Event, ExceptionType} from 'sentry/types/event';
import type {PlatformKey, Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  eventId: Event['id'];
  projectSlug: Project['slug'];
  type: 'original' | 'minified';
  values: ExceptionType['values'];
  platform?: PlatformKey;
}

export default function RawContent({
  eventId,
  projectSlug,
  type,
  platform,
  values,
}: Props) {
  const organization = useOrganization();

  const isNative =
    platform === 'native' || platform === 'cocoa' || platform === 'nintendo-switch';

  const hasCrashReport = isNative && defined(organization);

  const {
    data: crashReport,
    isPending,
    isError,
  } = useApiQuery<string>(
    [
      // Note that this endpoint does not have a trailing slash for some reason
      `/projects/${organization.slug}/${projectSlug}/events/${eventId}/apple-crash-report`,
      {
        query: {minified: String(type === 'minified')},
        headers: {Accept: '*/*; charset=utf-8'},
      },
    ],
    {
      enabled: hasCrashReport,
      staleTime: Infinity,
    }
  );

  if (isPending && hasCrashReport) {
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
          const nonNativeContent = exc.stacktrace ? (
            rawStacktraceContent(
              type === 'original' ? exc.stacktrace : exc.rawStacktrace,
              platform,
              exc
            )
          ) : (
            <div>
              {exc.type}: {exc.value}
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
