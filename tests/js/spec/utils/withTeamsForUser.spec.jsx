import React from 'react';
import {mount} from 'enzyme';

import withTeamsForUser from 'app/utils/withTeamsForUser';

describe('withUserTeams HoC', function() {
  const api = new MockApiClient();
  const organization = TestStubs.Organization();

  beforeEach(function() {
    MockApiClient.clearMockResponses();
  });

  it('forwards errors', async function() {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/user-teams/`,
      statusCode: 400,
    });
    const MyComponent = () => null;
    const Container = withTeamsForUser(MyComponent);
    const wrapper = mount(<Container organization={organization} api={api} />);
    await tick();
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
      url: `/organizations/${organization.slug}/user-teams/`,
      body: mockTeams,
    });

    const MyComponent = () => null;
    const Container = withTeamsForUser(MyComponent);
    const wrapper = mount(<Container organization={organization} api={api} />);
    await tick();
    expect(
      wrapper
        .update()
        .find('MyComponent')
        .prop('teams')
    ).toEqual(mockTeams);
  });
});
