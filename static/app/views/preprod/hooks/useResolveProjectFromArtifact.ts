import {decodeScalar} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import type {BuildDetailsApiResponse} from 'sentry/views/preprod/types/buildDetailsTypes';

export function useResolveProjectFromArtifact(
  buildDetailsData: BuildDetailsApiResponse | undefined
): string | undefined {
  const {project: projectFromUrl} = useLocationQuery({
    fields: {project: decodeScalar},
  });

  return projectFromUrl || buildDetailsData?.project_slug;
}
