import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import type {SupergroupDetail} from 'sentry/views/issueList/supergroups/types';
import {useSuperGroups} from 'sentry/views/issueList/supergroups/useSuperGroups';

const organization = OrganizationFixture({features: ['top-issues-ui']});
const API_URL = `/organizations/${organization.slug}/seer/supergroups/by-group/`;

function makeSupergroup(overrides: Partial<SupergroupDetail> = {}): SupergroupDetail {
  return {
    id: 1,
    title: 'Test Supergroup',
    summary: 'A test supergroup',
    error_type: 'TypeError',
    code_area: 'frontend',
    group_ids: [1, 2, 3],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('useSuperGroups', () => {
  it('does not show loading state when archiving a group backfills a new one', async () => {
    const supergroup = makeSupergroup({group_ids: [1, 2, 3]});
    const mockRequest = MockApiClient.addMockResponse({
      url: API_URL,
      body: {data: [supergroup]},
    });

    const {result, rerender} = renderHookWithProviders(
      (props: {groupIds: string[]}) => useSuperGroups(props.groupIds),
      {
        organization,
        initialProps: {groupIds: ['1', '2', '3']},
      }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockRequest).toHaveBeenCalledTimes(1);

    // Group '3' is archived and removed from the list
    rerender({groupIds: ['1', '2']});
    expect(result.current.isLoading).toBe(false);
    expect(mockRequest).toHaveBeenCalledTimes(1);

    // A new group backfills into the list — should refetch in the background
    rerender({groupIds: ['1', '2', '4']});
    expect(result.current.isLoading).toBe(false);

    await waitFor(() => expect(mockRequest).toHaveBeenCalledTimes(2));
  });

  it('shows loading state when navigating to an entirely new page', async () => {
    const supergroup = makeSupergroup({group_ids: [1, 2, 3]});
    const mockRequest = MockApiClient.addMockResponse({
      url: API_URL,
      body: {data: [supergroup]},
    });

    const {result, rerender} = renderHookWithProviders(
      (props: {groupIds: string[]}) => useSuperGroups(props.groupIds),
      {
        organization,
        initialProps: {groupIds: ['1', '2', '3']},
      }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockRequest).toHaveBeenCalledTimes(1);

    // Navigate to a completely different page of results
    rerender({groupIds: ['4', '5', '6']});
    expect(result.current.isLoading).toBe(true);
  });
});
