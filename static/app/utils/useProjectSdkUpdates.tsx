import {useEffect, useMemo, useState} from 'react';

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
  projectId: Project['id'] | null;
}

export function useProjectSdkUpdates(
  options: UseProjectSdkOptions
): RequestState<ProjectSdkUpdates | null> {
  const api = useApi();
  const [state, setState] = useState<RequestState<ProjectSdkUpdates[] | null>>({
    type: 'initial',
  });

  useEffect(() => {
    let unmounted = false;

    loadSdkUpdates(api, options.organization.slug)
      .then(data => {
        if (unmounted) {
          return;
        }

        setState({
          type: 'resolved',
          data,
        });
      })
      .catch(e => {
        if (unmounted) {
          return;
        }
        setState({
          type: 'errored',
          error: e,
        });
      });

    return () => {
      unmounted = true;
    };
  }, [api, options.organization.slug]);

  const stateForProject = useMemo((): RequestState<ProjectSdkUpdates | null> => {
    if (!options.projectId) {
      return {
        ...state,
        type: 'resolved',
        data: null,
      };
    }
    if (state.type === 'resolved') {
      return {
        ...state,
        type: 'resolved',
        data:
          state.type === 'resolved' && state.data
            ? state.data.find(sdk => sdk.projectId === options.projectId) ?? null
            : null,
      };
    }

    return state;
  }, [state, options.projectId]);

  return stateForProject;
}
