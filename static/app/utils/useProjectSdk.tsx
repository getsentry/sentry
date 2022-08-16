import {useEffect, useState} from 'react';

import {Client} from 'sentry/api';
import {RequestState} from 'sentry/types';

import {Organization} from '../types/organization';
import {Project, ProjectSdkUpdates} from '../types/project';

import useApi from './useApi';

function loadSdkUpdates(api: Client, orgSlug: string): Promise<ProjectSdkUpdates[]> {
  return api.requestPromise(`/organizations/${orgSlug}/sdk-updates/`);
}

interface UseProjectSdkOptions {
  organization: Organization;
  projectId: Project['id'];
}

export function useProjectSdkUpdates(
  options: UseProjectSdkOptions
): RequestState<ProjectSdkUpdates | null> {
  const api = useApi();

  const [state, setState] = useState<RequestState<ProjectSdkUpdates | null>>({
    type: 'initial',
  });

  useEffect(() => {
    if (options.projectId === undefined) {
      return undefined;
    }

    let unmounted = false;

    loadSdkUpdates(api, options.organization.slug).then(data => {
      if (unmounted) {
        return;
      }

      setState({
        type: 'resolved',
        data: data.find(project => project.projectId === options.projectId) ?? null,
      });
    });

    return () => {
      unmounted = true;
    };
  }, [api, options.projectId, options.organization.slug]);

  return state;
}
