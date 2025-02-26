import {Fragment} from 'react';

import ClippedBox from 'sentry/components/clippedBox';
import rawStacktraceContent from 'sentry/components/events/interfaces/crashContent/stackTrace/rawContent';
import LoadingError from 'sentry/components/loadingError';
import Placeholder from 'sentry/components/placeholder';
import type {Event, ExceptionType} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import type {PlatformKey, Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

interface Props extends Pick<ExceptionType, 'values'> {
  eventId: Event['id'];
  projectSlug: Project['slug'];
  type: 'original' | 'minified';
  organization?: Organization;
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

  const endpointUrl = `/projects/${organization.slug}/${projectSlug}/events/${eventId}/apple-crash-report?minified=${type === 'minified'}`;

  const {data, isPending, isError} = useApiQuery<string>(
    [endpointUrl, {headers: {Accept: '*/*; charset=utf-8'}}],
    {enabled: isNative && defined(organization), staleTime: Infinity}
  );

  if (!values) {
    return null;
  }

  if (isPending) {
    return <Placeholder height="270px" />;
  }

  if (isError) {
    return <LoadingError />;
  }

  return (
    <Fragment>
      {values.map((exc, excIdx) => {
        if (!isNative) {
          const nonNativeContent = exc.stacktrace
            ? rawStacktraceContent(
                type === 'original' ? exc.stacktrace : exc.rawStacktrace,
                platform,
                exc
              )
            : null;
          return (
            <div key={excIdx} data-test-id="raw-stack-trace">
              <pre className="traceback plain">{nonNativeContent}</pre>
            </div>
          );
        }

        return (
          <div key={excIdx} data-test-id="raw-stack-trace">
            <pre className="traceback plain">
              <ClippedBox clipHeight={250}>{data}</ClippedBox>
            </pre>
          </div>
        );
      })}
    </Fragment>
  );
}
