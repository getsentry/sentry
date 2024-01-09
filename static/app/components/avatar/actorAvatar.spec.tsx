import {OrganizationFixture} from 'sentry-fixture/organization';
import {TeamFixture} from 'sentry-fixture/team';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import MemberListStore from 'sentry/stores/memberListStore';
import OrganizationStore from 'sentry/stores/organizationStore';
import TeamStore from 'sentry/stores/teamStore';
import type {Team as TeamType, User as UserType} from 'sentry/types';

describe('ActorAvatar', function () {
  const user: UserType = {
    ...UserFixture(),
    id: '1',
    name: 'JanActore Bloggs',
    email: 'janebloggs@example.com',
  };
  const team1: TeamType = {
    ...TeamFixture(),
    id: '3',
    slug: 'cool-team',
    name: 'COOL TEAM',
  };

  beforeEach(function () {
    MemberListStore.loadInitialData([user]);
    TeamStore.loadInitialData([team1]);
  });

  it('should show a gravatar when actor type is a user', function () {
    render(
      <ActorAvatar
        actor={{
          id: '1',
          name: 'Jane Bloggs',
          type: 'user',
        }}
      />
    );
  });

  it('should not show a gravatar when actor type is a team', function () {
    render(
      <ActorAvatar
        actor={{
          id: '3',
          name: 'COOL TEAM',
          type: 'team',
        }}
      />
    );

    expect(screen.getByText('CT')).toBeInTheDocument();
  });

  it('should return null when actor type is a unknown', function () {
    render(
      <ActorAvatar
        actor={{
          id: '3',
          name: 'COOL TEAM',
          // @ts-expect-error (type shall be incorrect here)
          type: 'teapot',
        }}
      />
    );

    expect(screen.queryByText('CT')).not.toBeInTheDocument();
  });

  it('should fetch a team not in the store', async function () {
    const organization = OrganizationFixture();

    OrganizationStore.onUpdate(organization, {replace: true});

    const team2 = TeamFixture({id: '2', name: 'COOL TEAM', slug: 'cool-team'});

    const mockRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/teams/`,
      method: 'GET',
      body: [team2],
    });

    render(
      <ActorAvatar
        actor={{
          id: team2.id,
          name: team2.name,
          type: 'team',
        }}
      />
    );

    expect(await screen.findByText('CT')).toBeInTheDocument();
    expect(mockRequest).toHaveBeenCalled();
  });
});
