import type {Scope} from '@sentry/core';
import * as Sentry from '@sentry/react';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TeamFixture} from 'sentry-fixture/team';

import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import type {ApiResult} from 'sentry/api';
import {ORGANIZATION_FETCH_ERROR_TYPES} from 'sentry/constants';
import OrganizationStore from 'sentry/stores/organizationStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import TeamStore from 'sentry/stores/teamStore';
import type {Organization} from 'sentry/types/organization';
import FeatureFlagOverrides from 'sentry/utils/featureFlagOverrides';
import localStorageWrapper from 'sentry/utils/localStorage';
import {
  DEFAULT_QUERY_CLIENT_CONFIG,
  QueryClient,
  QueryClientProvider,
} from 'sentry/utils/queryClient';

import {
  useBootstrapOrganizationQuery,
  useBootstrapProjectsQuery,
  useBootstrapTeamsQuery,
} from './bootstrapRequests';

const queryClient = new QueryClient(DEFAULT_QUERY_CLIENT_CONFIG);
const wrapper = ({children}: {children?: React.ReactNode}) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('useBootstrapOrganizationQuery', () => {
  const org = OrganizationFixture();
  const orgSlug = 'org-slug';

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    OrganizationStore.reset();
    queryClient.clear();
    localStorageWrapper.clear();
  });

  it('updates organization store with fetched data', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${orgSlug}/`,
      body: org,
      query: {detailed: 0, include_feature_flags: 1},
    });

    const {result} = renderHook(useBootstrapOrganizationQuery, {
      wrapper,
      initialProps: orgSlug,
    });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(JSON.stringify(OrganizationStore.get().organization)).toEqual(
      JSON.stringify(org)
    );
  });

  it('handles api errors', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${orgSlug}/`,
      statusCode: 401,
      body: {},
    });

    const {result} = renderHook(useBootstrapOrganizationQuery, {
      wrapper,
      initialProps: orgSlug,
    });

    await waitFor(() => expect(result.current.error).toBeDefined());
    expect(OrganizationStore.get().organization).toBeNull();
    await waitFor(() => expect(OrganizationStore.get().error).toBe(result.current.error));
    expect(OrganizationStore.get().errorType).toBe(
      ORGANIZATION_FETCH_ERROR_TYPES.ORG_NO_ACCESS
    );
  });

  it('does not fetch when orgSlug is null', () => {
    const {result} = renderHook(useBootstrapOrganizationQuery, {
      wrapper,
      initialProps: null,
    });
    expect(result.current.data).toBeUndefined();
  });

  it('removes the promise from window.__sentry_preload after use', async () => {
    window.__sentry_preload = {
      orgSlug: org.slug,
      organization: Promise.resolve<ApiResult<Organization>>([org, undefined, undefined]),
    };
    const {result} = renderHook(useBootstrapOrganizationQuery, {
      wrapper,
      initialProps: orgSlug,
    });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(window.__sentry_preload?.organization).toBeUndefined();
  });

  it('sets feature flags, activates organization, and sets sentry tags', async () => {
    // Feature flag overrides are loaded from localstorage
    localStorageWrapper.setItem('feature-flag-overrides', '{"enable-issues":true}');

    const mockScope = {
      setTag: jest.fn(),
      setContext: jest.fn(),
    } as unknown as Scope;
    jest.spyOn(Sentry, 'getCurrentScope').mockReturnValue(mockScope);

    MockApiClient.addMockResponse({
      url: `/organizations/${orgSlug}/`,
      body: org,
      query: {detailed: 0, include_feature_flags: 1},
    });

    const {result} = renderHook(useBootstrapOrganizationQuery, {
      wrapper,
      initialProps: orgSlug,
    });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(JSON.stringify(OrganizationStore.get().organization?.features)).toEqual(
      JSON.stringify(['enable-issues'])
    );
    expect(FeatureFlagOverrides.singleton().getEnabledFeatureFlagList(org)).toEqual([
      'enable-issues',
    ]);
    expect(mockScope.setTag).toHaveBeenCalledWith('organization', org.id);
    expect(mockScope.setTag).toHaveBeenCalledWith('organization.slug', org.slug);
    expect(mockScope.setContext).toHaveBeenCalledWith('organization', {
      id: org.id,
      slug: org.slug,
    });
  });
});

describe('useBootstrapTeamsQuery', () => {
  const mockTeams = [TeamFixture()];
  const orgSlug = 'org-slug';

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    TeamStore.reset();
    queryClient.clear();
  });

  it('updates team store with fetched data', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${orgSlug}/teams/`,
      body: mockTeams,
      headers: {
        Link: '<http://127.0.0.1:8000/api/0/organizations/org-slug/teams/?cursor=0:0:1>; rel="previous"; results="false"; cursor="0:0:1", <http://127.0.0.1:8000/api/0/organizations/org-slug/teams/?cursor=0:100:0>; rel="next"; results="true"; cursor="0:100:0"',
      },
    });

    const {result} = renderHook(useBootstrapTeamsQuery, {wrapper, initialProps: orgSlug});

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(TeamStore.getState().teams).toEqual(mockTeams);
    expect(TeamStore.getState().hasMore).toBe(true);
  });

  it('handles api errors', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${orgSlug}/teams/`,
      statusCode: 500,
    });

    const {result} = renderHook(useBootstrapTeamsQuery, {wrapper, initialProps: orgSlug});

    await waitFor(() => expect(result.current.error).toBeDefined());
    expect(TeamStore.getState().teams).toEqual([]);
  });

  it('does not fetch when orgSlug is null', () => {
    const {result} = renderHook(useBootstrapTeamsQuery, {wrapper, initialProps: null});
    expect(result.current.data).toBeUndefined();
  });
});

describe('useBootstrapProjectsQuery', () => {
  const mockProjects = [ProjectFixture()];
  const orgSlug = 'org-slug';

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    ProjectsStore.reset();
    queryClient.clear();
  });

  it('updates projects store with fetched data', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${orgSlug}/projects/`,
      body: mockProjects,
      query: {
        all_projects: 1,
        collapse: ['latestDeploys', 'unusedFeatures'],
      },
    });

    const {result} = renderHook(useBootstrapProjectsQuery, {
      wrapper,
      initialProps: orgSlug,
    });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(ProjectsStore.getState().projects).toEqual(mockProjects);
  });

  it('handles api errors', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${orgSlug}/projects/`,
      statusCode: 500,
    });

    const {result} = renderHook(useBootstrapProjectsQuery, {
      wrapper,
      initialProps: orgSlug,
    });

    await waitFor(() => expect(result.current.error).toBeDefined());
    expect(ProjectsStore.getState().projects).toEqual([]);
  });

  it('does not fetch when orgSlug is null', () => {
    const {result} = renderHook(useBootstrapProjectsQuery, {wrapper, initialProps: null});
    expect(result.current.data).toBeUndefined();
  });
});
