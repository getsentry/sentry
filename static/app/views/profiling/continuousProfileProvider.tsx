import {createContext, useContext, useLayoutEffect, useMemo, useState} from 'react';
import * as Sentry from '@sentry/react';
import * as qs from 'query-string';

import type {Client} from 'sentry/api';
import {ContinuousProfileHeader} from 'sentry/components/profiling/continuousProfileHeader';
import type {RequestState} from 'sentry/types/core';
import type {EventTransaction} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {useSentryEvent} from 'sentry/utils/profiling/hooks/useSentryEvent';
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
    .then(([data]) => data.chunk);
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

type ContinuousProfileSegmentProviderValue = RequestState<EventTransaction>;
export const ContinuousProfileSegmentContext =
  createContext<ContinuousProfileSegmentProviderValue | null>(null);

export function useContinuousProfileSegment() {
  const context = useContext(ContinuousProfileSegmentContext);
  if (!context) {
    throw new Error(
      'useContinuousProfileSegment was called outside of ContinuousProfileSegmentProvider'
    );
  }
  return context;
}

function isValidDate(date: string): boolean {
  return !isNaN(Date.parse(date));
}

function getContinuousChunkQueryParams(
  query: string
): ContinuousProfileQueryParams | null {
  const queryString = new URLSearchParams(query);
  const start = queryString.get('start');
  const end = queryString.get('end');
  const profiler_id = queryString.get('profilerId');

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

  const eventPayload = useMemo(() => {
    const query = qs.parse(window.location.search);

    return {
      project: projects.projects.find(p => p.slug === params.projectId),
      eventId: query.eventId as string,
    };
  }, [projects, params.projectId]);

  const profileTransaction = useSentryEvent<EventTransaction>(
    organization.slug,
    eventPayload.project?.id ?? '',
    eventPayload.eventId
  );

  return (
    <ContinuousProfileContext.Provider value={profiles}>
      <ContinuousProfileSegmentContext.Provider value={profileTransaction}>
        <ContinuousProfileHeader />
        {props.children}
      </ContinuousProfileSegmentContext.Provider>
    </ContinuousProfileContext.Provider>
  );
}

export default ContinuousProfileProvider;
