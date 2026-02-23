import {useEffect} from 'react';

import {decodeScalar} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import type {BuildDetailsApiResponse} from 'sentry/views/preprod/types/buildDetailsTypes';

export function useResolveProjectFromArtifact(
  buildDetailsData: BuildDetailsApiResponse | undefined
): string | undefined {
  const {project: projectFromUrl} = useLocationQuery({
    fields: {project: decodeScalar},
  });
  const location = useLocation();
  const navigate = useNavigate();

  const projectId = projectFromUrl || buildDetailsData?.project_id?.toString();

  useEffect(() => {
    if (!projectFromUrl && buildDetailsData?.project_id) {
      navigate(
        {
          ...location,
          query: {
            ...location.query,
            project: String(buildDetailsData.project_id),
          },
        },
        {replace: true}
      );
    }
  }, [projectFromUrl, buildDetailsData?.project_id, navigate, location]);

  return projectId;
}
