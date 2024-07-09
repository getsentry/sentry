import {createContext, useContext, useLayoutEffect, useState} from 'react';
import * as Sentry from '@sentry/react';

import type {Client} from 'sentry/api';
import {ContinuousProfileHeader} from 'sentry/components/profiling/continuousProfileHeader';
import type {RequestState} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import useProjects from 'sentry/utils/useProjects';

interface ContinuousProfileQueryParams {
  end: string;
  profiler_id: string;
  start: string;
}

function fetchContinuousProfileFlamegraph(
  api: Client,
  query: ContinuousProfileQueryParams,
  projectSlug: Project['slug'],
  orgSlug: Organization['slug']
): Promise<Profiling.ProfileInput> {
  return api
    .requestPromise(`/organizations/${orgSlug}/profiling/chunks/`, {
      method: 'GET',
      query: {
        ...query,
        project: projectSlug,
      },
      includeAllArgs: true,
    })
    .then(([data]) => data);
}

type ContinuousProfileProviderValue = RequestState<Profiling.ProfileInput>;
export const ContinuousProfileContext =
  createContext<ContinuousProfileProviderValue | null>(null);

export function useContinuousProfile() {
  const context = useContext(ContinuousProfileContext);
  if (!context) {
    throw new Error('useContinuousProfile was called outside of ProfileProvider');
  }
  return context;
}

function isValidDate(date: string): boolean {
  return !isNaN(Date.parse(date));
}

function getContinuousChunkQueryParams(
  query: string
): ContinuousProfileQueryParams | null {
  const qs = new URLSearchParams(query);
  const start = qs.get('start');
  const end = qs.get('end');
  const profiler_id = qs.get('profilerId');

  if (!start || !end || !profiler_id) {
    return null;
  }

  if (!isValidDate(start) || !isValidDate(end)) {
    return null;
  }

  return {
    start,
    end,
    profiler_id,
  };
}

interface ContinuousFlamegraphViewProps {
  children: React.ReactNode;
}

function ContinuousProfileProvider(
  props: ContinuousFlamegraphViewProps
): React.ReactElement {
  const api = useApi();
  const params = useParams();
  const organization = useOrganization();
  const projects = useProjects();

  const [profiles, setProfiles] = useState<RequestState<Profiling.ProfileInput>>({
    type: 'initial',
  });

  useLayoutEffect(() => {
    if (!params.projectId) {
      return undefined;
    }

    const chunkParams = getContinuousChunkQueryParams(window.location.search);
    const project = projects.projects.find(p => p.slug === params.projectId);

    if (!chunkParams) {
      Sentry.captureMessage(
        'Failed to fetch continuous profile - invalid query parameters.'
      );
      return undefined;
    }
    if (!project) {
      Sentry.captureMessage('Failed to fetch continuous profile - project not found.');
      return undefined;
    }

    setProfiles({type: 'loading'});

    fetchContinuousProfileFlamegraph(api, chunkParams, project.id, organization.slug)
      .then(p => {
        setProfiles({type: 'resolved', data: p});
      })
      .catch(err => {
        setProfiles({type: 'errored', error: 'Failed to fetch profiles'});
        Sentry.captureException(err);
      });

    return () => api.clear();
  }, [api, organization.slug, projects.projects, params.projectId]);

  return (
    <ContinuousProfileContext.Provider value={profiles}>
      <ContinuousProfileHeader />
      {props.children}
    </ContinuousProfileContext.Provider>
  );
}

export default ContinuousProfileProvider;
