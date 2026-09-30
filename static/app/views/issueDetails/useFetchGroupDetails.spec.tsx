import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {ProjectFixture} from 'sentry-fixture/project';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';
import {setWindowLocation} from 'sentry-test/utils';

import {GroupStore} from 'sentry/stores/groupStore';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {useParams} from 'sentry/utils/useParams';
import {useFetchGroupDetails} from 'sentry/views/issueDetails/groupDetails';
import {GroupIdProvider} from 'sentry/views/issueDetails/groupIdContext';

function GroupRouteProvider({children}: {children?: React.ReactNode}) {
  const {groupId} = useParams<{groupId: string}>();
  return <GroupIdProvider groupId={groupId}>{children}</GroupIdProvider>;
}

describe('useFetchGroupDetails', () => {
  const project = ProjectFixture();
  const group = GroupFixture({id: '1', project, hasSeen: true});
  const firstEvent = EventFixture({id: 'first-event', groupID: group.id});

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    act(() => ProjectsStore.loadInitialData([project]));
    setWindowLocation(`http://localhost/?project=${project.id}`);
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/`,
      body: group,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/events/recommended/`,
      body: firstEvent,
    });
  });

  afterEach(() => {
    act(() => ProjectsStore.reset());
    GroupStore.reset();
    MockApiClient.clearMockResponses();
  });

  it.each([
    {
      description: 'retains the event while loading another event in the same issue',
      nextGroupId: group.id,
      pendingEvent: firstEvent,
    },
    {
      description: 'clears the event while loading an event from another issue',
      nextGroupId: '2',
      pendingEvent: null,
    },
  ])('$description', async ({nextGroupId, pendingEvent}) => {
    const {result, router} = renderHookWithProviders(useFetchGroupDetails, {
      additionalWrapper: GroupRouteProvider,
      initialRouterConfig: {
        route: '/organizations/:orgId/issues/:groupId/',
        location: {pathname: `/organizations/org-slug/issues/${group.id}/`},
      },
    });
    await waitFor(() => expect(result.current.event).toEqual(firstEvent));

    const nextEvent = EventFixture({id: 'next-event', groupID: nextGroupId});
    const eventResponse = Promise.withResolvers<void>();
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${nextGroupId}/`,
      body: {...group, id: nextGroupId},
    });
    const nextEventRequest = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${nextGroupId}/events/recommended/`,
      match: [MockApiClient.matchQuery({query: 'release:next'})],
      body: nextEvent,
      asyncDelay: eventResponse.promise,
    });

    router.navigate(`/organizations/org-slug/issues/${nextGroupId}/?query=release:next`);
    await waitFor(() => expect(nextEventRequest).toHaveBeenCalled());
    await waitFor(() => expect(result.current.group?.id).toBe(nextGroupId));
    expect(result.current.event).toEqual(pendingEvent);

    await act(() => {
      eventResponse.resolve();
      return eventResponse.promise;
    });
    await waitFor(() => expect(result.current.event).toEqual(nextEvent));
  });
});
