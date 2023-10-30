import {useEffect, useState} from 'react';
import * as Sentry from '@sentry/react';

import {Organization, Project, ProjectKey, RequestState} from 'sentry/types';

import useApi from './useApi';

export function useProjectKeys({
  organization,
  project,
}: {
  organization: Organization | null;
  project: Project | null;
}) {
  const api = useApi();
  const [response, setResponse] = useState<RequestState<ProjectKey[]>>({
    type: 'initial',
  });
  useEffect(() => {
    if (!organization || !project) {
      return () => {};
    }
    setResponse({type: 'loading'});
    const request: Promise<ProjectKey[]> = api.requestPromise(
      `/projects/${organization.slug}/${project.slug}/keys/`
    );

    request
      .then(data => {
        setResponse({
          type: 'resolved',
          data,
        });
      })
      .catch(error => {
        setResponse({
          type: 'errored',
          error,
        });
        Sentry.captureException(error);
      });

    return () => {
      api.clear();
    };
  }, [organization, project, api]);

  return response;
}
