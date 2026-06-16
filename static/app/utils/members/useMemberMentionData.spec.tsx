import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useMemberMentionData} from 'sentry/utils/members/useMemberMentionData';

describe('useMemberMentionData', () => {
  const org = OrganizationFixture();

  it('fetches member mention suggestions from search results', async () => {
    const defaultUser = UserFixture({
      id: '1',
      name: 'Foo Bar',
      email: 'foo@example.com',
    });
    const searchedUser = UserFixture({
      id: '2',
      name: 'Nick Search',
      email: 'nick@example.com',
    });
    const defaultRequest = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/members/`,
      method: 'GET',
      body: [{user: defaultUser}],
    });
    const searchRequest = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/members/`,
      method: 'GET',
      body: [{user: searchedUser}],
      match: [MockApiClient.matchQuery({query: 'nick'})],
    });

    const {result} = renderHookWithProviders(useMemberMentionData, {
      organization: org,
    });
    const callback = jest.fn();

    await waitFor(() => expect(defaultRequest).toHaveBeenCalled());
    await act(() => result.current.getMemberSuggestions('nick', callback));

    expect(searchRequest).toHaveBeenCalled();
    expect(callback).toHaveBeenCalledWith([{id: 'user:2', display: 'Nick Search'}]);
  });
});
