import {QueryClientProvider} from '@tanstack/react-query';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {renderHook} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {parseQueryKey} from 'sentry/utils/api/apiQueryKey';
import {OrganizationContext} from 'sentry/utils/organizationContext';
import type {Block, CallRecord, SeerExplorerRunId} from 'sentry/views/seerExplorer/types';

import {useRefreshPageOnSeerWrite} from './useRefreshPageOnSeerWrite';

const organization = OrganizationFixture({id: '1', slug: 'acme'});
const project = ProjectFixture({id: '42', slug: 'frontend'});

const orgPath = {organizationIdOrSlug: 'acme'};
const projectPath = {...orgPath, projectIdOrSlug: 'frontend'};

const CACHED_QUERY_KEYS = [
  apiOptions.as<unknown>()('/organizations/$organizationIdOrSlug/workflows/', {
    path: orgPath,
    staleTime: 0,
  }).queryKey,
  apiOptions.as<unknown>()(
    '/organizations/$organizationIdOrSlug/workflows/$workflowId/',
    {path: {...orgPath, workflowId: '7'}, staleTime: 0}
  ).queryKey,
  apiOptions.as<unknown>()('/organizations/$organizationIdOrSlug/detectors/', {
    path: orgPath,
    staleTime: 0,
  }).queryKey,
  apiOptions.as<unknown>()(
    '/organizations/$organizationIdOrSlug/detectors/$detectorId/',
    {path: {...orgPath, detectorId: '9'}, staleTime: 0}
  ).queryKey,
  apiOptions.as<unknown>()('/organizations/$organizationIdOrSlug/issues/', {
    path: orgPath,
    staleTime: 0,
  }).queryKey,
  apiOptions.as<unknown>()('/organizations/$organizationIdOrSlug/issues/$issueId/', {
    path: {...orgPath, issueId: '123'},
    staleTime: 0,
  }).queryKey,
  apiOptions.as<unknown>()('/organizations/$organizationIdOrSlug/', {
    path: orgPath,
    staleTime: 0,
  }).queryKey,
  apiOptions.as<unknown>()('/projects/$organizationIdOrSlug/$projectIdOrSlug/', {
    path: projectPath,
    staleTime: 0,
  }).queryKey,
  apiOptions.as<unknown>()('/projects/$organizationIdOrSlug/$projectIdOrSlug/keys/', {
    path: projectPath,
    staleTime: 0,
  }).queryKey,
];

const CACHED_URLS = CACHED_QUERY_KEYS.map(queryKey => parseQueryKey(queryKey).url);

function makeBlock(id: string, calls: CallRecord[]): Block {
  return {
    id,
    timestamp: '2026-01-01T00:00:00Z',
    message: {role: 'tool_use', content: null},
    tool_results: [
      {
        content: '',
        tool_call_function: 'sentry_api_execute',
        tool_call_id: `call-${id}`,
        structuredContent: {calls},
      },
    ],
  };
}

const createAlert: CallRecord = {
  id: 1,
  kind: 'api',
  method: 'POST',
  path: '/api/0/organizations/{organization_id_or_slug}/workflows/',
  path_params: {organization_id_or_slug: 'acme'},
  status: 201,
};

const updateAlert: CallRecord = {
  id: 2,
  kind: 'api',
  method: 'PUT',
  path: '/api/0/organizations/{organization_id_or_slug}/workflows/{workflow_id}/',
  // Seer may address the org by id; the frontend keys it by slug.
  path_params: {organization_id_or_slug: '1', workflow_id: '7'},
  status: 200,
};

const listIssues: CallRecord = {
  id: 3,
  kind: 'api',
  method: 'GET',
  path: '/api/0/organizations/{organization_id_or_slug}/issues/',
  path_params: {organization_id_or_slug: 'acme'},
  status: 200,
};

function renderRefreshHook(initialBlocks: Block[] | undefined) {
  const queryClient = makeTestQueryClient();
  for (const queryKey of CACHED_QUERY_KEYS) {
    queryClient.setQueryData(queryKey, {json: {}, headers: {}});
  }
  const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
  const hook = renderHook(useRefreshPageOnSeerWrite, {
    initialProps: {runId: 1 as SeerExplorerRunId, blocks: initialBlocks},
    wrapper: ({children}) => (
      <QueryClientProvider client={queryClient}>
        <OrganizationContext value={organization}>{children}</OrganizationContext>
      </QueryClientProvider>
    ),
  });
  const invalidatedUrls = () =>
    CACHED_QUERY_KEYS.filter(
      queryKey => queryClient.getQueryState(queryKey)?.isInvalidated
    ).map(queryKey => parseQueryKey(queryKey).url);
  return {...hook, invalidateQueries, invalidatedUrls};
}

describe('useRefreshPageOnSeerWrite', () => {
  beforeEach(() => {
    ProjectsStore.loadInitialData([project]);
  });

  it('invalidates queries under the collection a create posted to', () => {
    const {rerender, invalidateQueries, invalidatedUrls} = renderRefreshHook([
      makeBlock('a', []),
    ]);

    rerender({runId: 1, blocks: [makeBlock('a', []), makeBlock('b', [createAlert])]});
    expect(invalidatedUrls()).toEqual([
      '/organizations/acme/workflows/',
      '/organizations/acme/workflows/7/',
    ]);
    expect(invalidateQueries).toHaveBeenCalledTimes(1);

    // The same write on a later poll is not new.
    rerender({runId: 1, blocks: [makeBlock('a', []), makeBlock('b', [createAlert])]});
    expect(invalidateQueries).toHaveBeenCalledTimes(1);
  });

  it('invalidates the item and its collection for an item write', () => {
    const {rerender, invalidatedUrls} = renderRefreshHook([]);

    rerender({runId: 1, blocks: [makeBlock('a', [updateAlert])]});
    expect(invalidatedUrls()).toEqual([
      '/organizations/acme/workflows/',
      '/organizations/acme/workflows/7/',
    ]);
  });

  it('resolves a project id to the slug the frontend keys by', () => {
    const {rerender, invalidatedUrls} = renderRefreshHook([]);

    rerender({
      runId: 1,
      blocks: [
        makeBlock('a', [
          {
            id: 1,
            kind: 'api',
            method: 'POST',
            path: '/api/0/projects/{organization_id_or_slug}/{project_id_or_slug}/keys/',
            path_params: {organization_id_or_slug: 'acme', project_id_or_slug: '42'},
            status: 201,
          },
        ]),
      ],
    });
    expect(invalidatedUrls()).toEqual(['/projects/acme/frontend/keys/']);
  });

  it('reaches the same resource under a different scope', () => {
    const {rerender, invalidatedUrls} = renderRefreshHook([]);

    rerender({
      runId: 1,
      blocks: [
        makeBlock('a', [
          {
            id: 1,
            kind: 'api',
            method: 'POST',
            path: '/api/0/organizations/{organization_id_or_slug}/projects/{project_id_or_slug}/detectors/',
            path_params: {
              organization_id_or_slug: 'acme',
              project_id_or_slug: 'frontend',
            },
            status: 201,
          },
          {
            id: 2,
            kind: 'api',
            method: 'PUT',
            path: '/api/0/issues/{issue_id}/',
            path_params: {issue_id: '123'},
            status: 200,
          },
        ]),
      ],
    });
    expect(invalidatedUrls()).toEqual([
      '/organizations/acme/detectors/',
      '/organizations/acme/detectors/9/',
      '/organizations/acme/issues/',
      '/organizations/acme/issues/123/',
    ]);
  });

  it('limits a write to the project itself to its own path', () => {
    const {rerender, invalidatedUrls} = renderRefreshHook([]);

    rerender({
      runId: 1,
      blocks: [
        makeBlock('a', [
          {
            id: 1,
            kind: 'api',
            method: 'PUT',
            path: '/api/0/projects/{organization_id_or_slug}/{project_id_or_slug}/',
            path_params: {
              organization_id_or_slug: 'acme',
              project_id_or_slug: 'frontend',
            },
            status: 200,
          },
        ]),
      ],
    });
    expect(invalidatedUrls()).toEqual([
      '/projects/acme/frontend/',
      '/projects/acme/frontend/keys/',
    ]);
  });

  it('invalidates everything when the written route cannot be resolved', () => {
    const {rerender, invalidatedUrls} = renderRefreshHook([]);

    rerender({runId: 1, blocks: [makeBlock('a', [{...createAlert, path: undefined}])]});
    expect(invalidatedUrls()).toEqual(CACHED_URLS);
  });

  it('ignores reads, failed writes, and external provider writes', () => {
    const {rerender, invalidateQueries} = renderRefreshHook([]);

    rerender({
      runId: 1,
      blocks: [
        makeBlock('a', [
          listIssues,
          {...createAlert, id: 4, status: 400},
          {...createAlert, id: 5, status: undefined, error: 'ConnectError'},
          {...createAlert, id: 6, provider: 'github'},
        ]),
      ],
    });
    expect(invalidateQueries).not.toHaveBeenCalled();
  });

  it('skips writes already in a run when it is first loaded', () => {
    const {rerender, invalidateQueries} = renderRefreshHook(undefined);

    rerender({runId: 1, blocks: [makeBlock('a', [createAlert])]});
    rerender({runId: 2, blocks: [makeBlock('b', [createAlert])]});
    expect(invalidateQueries).not.toHaveBeenCalled();

    rerender({
      runId: 2,
      blocks: [makeBlock('b', [createAlert]), makeBlock('c', [createAlert])],
    });
    expect(invalidateQueries).toHaveBeenCalledTimes(1);
  });
});
