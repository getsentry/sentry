import React from 'react';
import {mount} from 'enzyme';

import withUsersTeams from 'app/utils/withUsersTeams';

describe('withUserTeams HoC', function() {
  const api = new MockApiClient();
  beforeEach(function() {
    MockApiClient.clearMockResponses();
  });

  it('forwards errors', async function() {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/user-teams/',
      statusCode: 400,
    });
    const MyComponent = () => null;
    const Container = withUsersTeams(MyComponent);
    const wrapper = mount(<Container organization={{slug: 'org-slug'}} api={api} />);
    await wrapper.instance().fetchTeams();
    expect(
      wrapper
        .update()
        .find('MyComponent')
        .prop('error')
    ).not.toBeNull();
  });

  it('fetches teams and works', async function() {
    const mockTeams = [
      {
        slug: 'sentry',
        projects: [],
      },
      {
        slug: 'captainplanet',
        projects: [],
      },
    ];

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/user-teams/',
      body: mockTeams,
    });

    const MyComponent = () => null;
    const Container = withUsersTeams(MyComponent);
    const wrapper = mount(<Container organization={{slug: 'org-slug'}} api={api} />);
    await wrapper.instance().fetchTeams();
    expect(
      wrapper
        .update()
        .find('MyComponent')
        .prop('teams')
    ).toEqual(mockTeams);
  });
});
