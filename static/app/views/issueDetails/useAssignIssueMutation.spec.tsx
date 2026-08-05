import {ActorFixture} from 'sentry-fixture/actor';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {GroupStore} from 'sentry/stores/groupStore';
import {useAssignIssueMutation} from 'sentry/views/issueDetails/useAssignIssueMutation';
import {useGroup} from 'sentry/views/issueDetails/useGroup';

describe('useAssignIssueMutation', () => {
  const organization = OrganizationFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    GroupStore.reset();
  });

  it('assigns an issue', async () => {
    const group = GroupFixture({id: '1'});
    const assignee = ActorFixture({id: '2', type: 'user'});
    const assignRequest = MockApiClient.addMockResponse({
      method: 'PUT',
      url: `/organizations/${organization.slug}/issues/${group.id}/`,
      body: {...group, assignedTo: assignee},
    });
    const {result} = renderHookWithProviders(useAssignIssueMutation, {organization});

    await act(async () => {
      await result.current.mutateAsync({
        actor: assignee,
        assignedBy: 'assignee_selector',
        groupId: group.id,
        orgSlug: organization.slug,
      });
    });

    expect(assignRequest).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/issues/${group.id}/`,
      expect.objectContaining({
        method: 'PUT',
        data: {assignedTo: `user:${assignee.id}`, assignedBy: 'assignee_selector'},
      })
    );
  });

  it.each([
    {
      name: 'assignment',
      assignedTo: ActorFixture({id: '2', type: 'user'}),
    },
    {
      name: 'unassignment',
      assignedTo: null,
    },
  ])('invalidates the group query after an $name', async ({assignedTo}) => {
    const group = GroupFixture({id: '1', activity: []});
    const response = {...group, assignedTo};

    GroupStore.add([group]);
    const assignRequest = MockApiClient.addMockResponse({
      method: 'PUT',
      url: `/organizations/${organization.slug}/issues/${group.id}/`,
      body: response,
    });
    const groupRequest = MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/${organization.slug}/issues/${group.id}/`,
      body: group,
    });

    const {result} = renderHookWithProviders(
      () => {
        useGroup({groupId: group.id});
        return useAssignIssueMutation();
      },
      {organization}
    );

    await waitFor(() => expect(groupRequest).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.mutateAsync({
        actor: assignedTo,
        groupId: group.id,
        orgSlug: organization.slug,
      });
    });

    expect(assignRequest).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(groupRequest).toHaveBeenCalledTimes(2));
    expect(GroupStore.get(group.id)?.assignedTo).toEqual(assignedTo);
  });
});
