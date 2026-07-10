import type {ReactNode} from 'react';
import {QueryClientProvider} from '@tanstack/react-query';
import {ActorFixture} from 'sentry-fixture/actor';
import {GroupFixture} from 'sentry-fixture/group';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {act, renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {GroupStore} from 'sentry/stores/groupStore';
import {useAssignIssueMutation} from 'sentry/views/issueDetails/useAssignIssueMutation';
import {groupApiOptions} from 'sentry/views/issueDetails/useGroup';

describe('useAssignIssueMutation', () => {
  const organization = {slug: 'org-slug'};

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    GroupStore.reset();
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
    const queryClient = makeTestQueryClient();
    const group = GroupFixture({id: '1', activity: []});
    const response = {...group, assignedTo};
    const queryKey = groupApiOptions({
      organizationSlug: organization.slug,
      groupId: group.id,
      environments: [],
    }).queryKey;

    queryClient.setQueryData(queryKey, {headers: {}, json: group});
    GroupStore.add([group]);
    MockApiClient.addMockResponse({
      method: 'PUT',
      url: `/organizations/${organization.slug}/issues/${group.id}/`,
      body: response,
    });

    const {result} = renderHookWithProviders(() => useAssignIssueMutation(), {
      organization,
      additionalWrapper: ({children}: {children?: ReactNode}) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });

    await act(async () => {
      await result.current.mutateAsync({
        actor: assignedTo,
        groupId: group.id,
        orgSlug: organization.slug,
      });
    });

    expect(queryClient.getQueryData(queryKey)?.json.assignedTo).toEqual(assignedTo);
    expect(queryClient.getQueryState(queryKey)?.isInvalidated).toBe(true);
    expect(GroupStore.get(group.id)?.assignedTo).toEqual(assignedTo);
  });
});
