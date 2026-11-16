import {useQueryClient} from '@tanstack/react-query';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import type {PlatformExternalIssue} from 'sentry/types/integrations';
import {apiOptions} from 'sentry/utils/api/apiOptions';

import {useExternalIssues} from './useExternalIssues';

const group = GroupFixture();
const organization = OrganizationFixture();
const options = apiOptions.as<PlatformExternalIssue[]>()(
  '/organizations/$organizationIdOrSlug/issues/$issueId/external-issues/',
  {
    path: {organizationIdOrSlug: organization.slug, issueId: group.id},
    staleTime: 60_000,
  }
);
const issue: PlatformExternalIssue = {
  id: '1',
  issueId: 'EXAMPLE-1',
  displayName: 'Example issue',
  serviceType: 'jira',
  webUrl: 'https://example.com/issues/1',
};

function useIssuesWithClient() {
  return {
    issues: useExternalIssues({group, organization}),
    client: useQueryClient(),
  };
}

afterEach(() => MockApiClient.clearMockResponses());

it('preserves metadata and cached responses when adding and deleting external issues', async () => {
  MockApiClient.addMockResponse({url: options.queryKey[0], body: []});
  const {result} = renderHookWithProviders(useIssuesWithClient);
  await waitFor(() => expect(result.current.issues.isLoading).toBe(false));
  const previous = {json: [], headers: {Link: 'next-page'}, status: 200};
  act(() => {
    result.current.client.setQueryData(options.queryKey, previous);
    result.current.issues.onCreateExternalIssue(issue);
  });
  await waitFor(() => expect(result.current.issues.data).toEqual([issue]));
  expect(result.current.client.getQueryData(options.queryKey)).toEqual({
    ...previous,
    json: [issue],
  });
  expect(previous.json).toEqual([]);
  act(() => result.current.issues.onDeleteExternalIssue(issue));
  await waitFor(() => expect(result.current.issues.data).toEqual([]));
  expect(result.current.client.getQueryData(options.queryKey)).toEqual(previous);
});

it('does not create cache entries for external issue updates on a cache miss', async () => {
  MockApiClient.addMockResponse({url: options.queryKey[0], body: []});
  const {result} = renderHookWithProviders(useIssuesWithClient);
  await waitFor(() => expect(result.current.issues.isLoading).toBe(false));
  act(() => {
    result.current.client.removeQueries({queryKey: options.queryKey});
    result.current.issues.onCreateExternalIssue(issue);
    result.current.issues.onDeleteExternalIssue(issue);
  });
  expect(result.current.client.getQueryData(options.queryKey)).toBeUndefined();
});
