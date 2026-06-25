import {useQueryClient} from '@tanstack/react-query';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import type {Group, GroupActivity} from 'sentry/types/group';
import {GroupActivityType} from 'sentry/types/group';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {useMutateActivity} from 'sentry/views/issueDetails/activitySection/useMutateActivity';
import {groupApiOptions} from 'sentry/views/issueDetails/useGroup';

describe('useMutateActivity', () => {
  const organization = OrganizationFixture();
  const group = GroupFixture({id: '1337', numComments: 1});

  const cachedGroupResponse = (g: Group): ApiResponse<Group> => ({
    json: g,
    headers: {},
  });

  // The group query key includes the selected environment, but the group's
  // activity is not environment-specific. These are two cache entries for the
  // same group viewed under different environment filters.
  const productionQueryKey = groupApiOptions({
    organizationSlug: organization.slug,
    groupId: group.id,
    environments: ['production'],
  }).queryKey;
  const allEnvironmentsQueryKey = groupApiOptions({
    organizationSlug: organization.slug,
    groupId: group.id,
    environments: [],
  }).queryKey;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('writes a created comment to every environment variant of the group cache', async () => {
    const newNote = {
      id: 'note-1',
      type: GroupActivityType.NOTE,
      data: {text: 'A new comment'},
      dateCreated: '2024-01-01T00:00:00.000Z',
      user: UserFixture(),
    };
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/comments/`,
      method: 'POST',
      body: newNote,
    });

    const {result} = renderHookWithProviders(
      () => {
        const queryClient = useQueryClient();
        const mutate = useMutateActivity({organization, group});
        return {queryClient, ...mutate};
      },
      {organization}
    );

    // Seed both environment cache entries as if each had been fetched.
    act(() => {
      result.current.queryClient.setQueryData(
        productionQueryKey,
        cachedGroupResponse(group)
      );
      result.current.queryClient.setQueryData(
        allEnvironmentsQueryKey,
        cachedGroupResponse(group)
      );
    });

    await act(async () => {
      await result.current.handleCreate({text: 'A new comment', mentions: []});
    });

    // The mutation only ran while "production" was selected, but switching to
    // another environment must not lose the new comment.
    await waitFor(() => {
      const allEnvData = result.current.queryClient.getQueryData(allEnvironmentsQueryKey);
      expect(allEnvData?.json.activity[0]?.id).toBe('note-1');
    });

    const prodData = result.current.queryClient.getQueryData(productionQueryKey);
    expect(prodData?.json.activity[0]?.id).toBe('note-1');
    expect(prodData?.json.numComments).toBe(2);

    const allEnvData = result.current.queryClient.getQueryData(allEnvironmentsQueryKey);
    expect(allEnvData?.json.numComments).toBe(2);
  });

  it('removes a deleted comment from every environment variant of the group cache', async () => {
    const existingNote: GroupActivity = {
      id: 'note-1',
      type: GroupActivityType.NOTE,
      data: {text: 'A comment'},
      dateCreated: '2024-01-01T00:00:00.000Z',
      user: UserFixture(),
    };
    const groupWithNote = GroupFixture({
      id: '1337',
      numComments: 1,
      activity: [existingNote],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/comments/note-1/`,
      method: 'DELETE',
      body: existingNote,
    });

    const {result} = renderHookWithProviders(
      () => {
        const queryClient = useQueryClient();
        const mutate = useMutateActivity({organization, group});
        return {queryClient, ...mutate};
      },
      {organization}
    );

    act(() => {
      result.current.queryClient.setQueryData(
        productionQueryKey,
        cachedGroupResponse(groupWithNote)
      );
      result.current.queryClient.setQueryData(
        allEnvironmentsQueryKey,
        cachedGroupResponse(groupWithNote)
      );
    });

    await act(async () => {
      await result.current.handleDelete('note-1');
    });

    await waitFor(() => {
      const allEnvData = result.current.queryClient.getQueryData(allEnvironmentsQueryKey);
      expect(allEnvData?.json.activity).toHaveLength(0);
    });

    const prodData = result.current.queryClient.getQueryData(productionQueryKey);
    expect(prodData?.json.activity).toHaveLength(0);
    expect(prodData?.json.numComments).toBe(0);
  });
});
