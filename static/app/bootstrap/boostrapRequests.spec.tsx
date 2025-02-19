import type {Scope} from '@sentry/core';
import * as Sentry from '@sentry/react';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TeamFixture} from 'sentry-fixture/team';

import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import type {ApiResult} from 'sentry/api';
import {ORGANIZATION_FETCH_ERROR_TYPES} from 'sentry/constants';
import LatestContextStore from 'sentry/stores/latestContextStore';
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

describe('useBootstrapOrganizationQuery', function () {
  const org = OrganizationFixture();
  const orgSlug = 'org-slug';

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    OrganizationStore.reset();
    queryClient.clear();
    localStorageWrapper.clear();
  });

  it('updates organization store with fetched data', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${orgSlug}/`,
      body: org,
      query: {detailed: 0, include_feature_flags: 1},
    });

    const {result} = renderHook(() => useBootstrapOrganizationQuery(orgSlug), {wrapper});

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(JSON.stringify(OrganizationStore.get().organization)).toEqual(
      JSON.stringify(org)
    );
  });

  it('handles api errors', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${orgSlug}/`,
      statusCode: 401,
      body: {},
    });

    const {result} = renderHook(() => useBootstrapOrganizationQuery(orgSlug), {wrapper});

    await waitFor(() => expect(result.current.error).toBeDefined());
    expect(OrganizationStore.get().organization).toBeNull();
    await waitFor(() => expect(OrganizationStore.get().error).toBe(result.current.error));
    expect(OrganizationStore.get().errorType).toBe(
      ORGANIZATION_FETCH_ERROR_TYPES.ORG_NO_ACCESS
    );
  });

  it('does not fetch when orgSlug is null', function () {
    const {result} = renderHook(() => useBootstrapOrganizationQuery(null), {wrapper});
    expect(result.current.data).toBeUndefined();
  });

  it('removes the promise from window.__sentry_preload after use', async function () {
    window.__sentry_preload = {
      orgSlug: org.slug,
      organization: Promise.resolve<ApiResult<Organization>>([org, undefined, undefined]),
    };
    const {result} = renderHook(() => useBootstrapOrganizationQuery(orgSlug), {wrapper});
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(window.__sentry_preload?.organization).toBeUndefined();
  });

  it('sets feature flags, activates organization, and sets sentry tags', async function () {
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

    const {result} = renderHook(() => useBootstrapOrganizationQuery(orgSlug), {wrapper});
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(JSON.stringify(OrganizationStore.get().organization?.features)).toEqual(
      JSON.stringify(['enable-issues'])
    );
    expect(JSON.stringify(LatestContextStore.get().organization)).toEqual(
      JSON.stringify({...org, features: ['enable-issues']})
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

describe('useBootstrapTeamsQuery', function () {
  const mockTeams = [TeamFixture()];
  const orgSlug = 'org-slug';

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    TeamStore.reset();
    queryClient.clear();
  });

  it('updates team store with fetched data', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${orgSlug}/teams/`,
      body: mockTeams,
      headers: {
        Link: '<http://127.0.0.1:8000/api/0/organizations/org-slug/teams/?cursor=0:0:1>; rel="previous"; results="false"; cursor="0:0:1", <http://127.0.0.1:8000/api/0/organizations/org-slug/teams/?cursor=0:100:0>; rel="next"; results="true"; cursor="0:100:0"',
      },
    });

    const {result} = renderHook(() => useBootstrapTeamsQuery(orgSlug), {wrapper});

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(TeamStore.getState().teams).toEqual(mockTeams);
    expect(TeamStore.getState().hasMore).toBe(true);
  });

  it('handles api errors', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${orgSlug}/teams/`,
      statusCode: 500,
    });

    const {result} = renderHook(() => useBootstrapTeamsQuery(orgSlug), {wrapper});

    await waitFor(() => expect(result.current.error).toBeDefined());
    expect(TeamStore.getState().teams).toEqual([]);
  });

  it('does not fetch when orgSlug is null', function () {
    const {result} = renderHook(() => useBootstrapTeamsQuery(null), {wrapper});
    expect(result.current.data).toBeUndefined();
  });
});

describe('useBootstrapProjectsQuery', function () {
  const mockProjects = [ProjectFixture()];
  const orgSlug = 'org-slug';

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    ProjectsStore.reset();
    queryClient.clear();
  });

  it('updates projects store with fetched data', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${orgSlug}/projects/`,
      body: mockProjects,
      query: {
        all_projects: 1,
        collapse: ['latestDeploys', 'unusedFeatures'],
      },
    });

    const {result} = renderHook(() => useBootstrapProjectsQuery(orgSlug), {wrapper});

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(ProjectsStore.getState().projects).toEqual(mockProjects);
  });

  it('handles api errors', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${orgSlug}/projects/`,
      statusCode: 500,
    });

    const {result} = renderHook(() => useBootstrapProjectsQuery(orgSlug), {wrapper});

    await waitFor(() => expect(result.current.error).toBeDefined());
    expect(ProjectsStore.getState().projects).toEqual([]);
  });

  it('does not fetch when orgSlug is null', function () {
    const {result} = renderHook(() => useBootstrapProjectsQuery(null), {wrapper});
    expect(result.current.data).toBeUndefined();
  });
});
