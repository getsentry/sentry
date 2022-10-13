import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import MemberListStore from 'sentry/stores/memberListStore';
import OrganizationStore from 'sentry/stores/organizationStore';
import TeamStore from 'sentry/stores/teamStore';
import {Team, User} from 'sentry/types';

describe('ActorAvatar', function () {
  const user: User = {
    ...TestStubs.User(),
    id: '1',
    name: 'JanActore Bloggs',
    email: 'janebloggs@example.com',
  };
  const team1: Team = {
    ...TestStubs.Team(),
    id: '3',
    slug: 'cool-team',
    name: 'COOL TEAM',
  };

  beforeEach(function () {
    MemberListStore.loadInitialData([user]);
    TeamStore.loadInitialData([team1]);
  });

  describe('render()', function () {
    it('should show a gravatar when actor type is a user', function () {
      const {container} = render(
        <ActorAvatar
          actor={{
            id: '1',
            name: 'Jane Bloggs',
            type: 'user',
          }}
        />
      );

      expect(container).toSnapshot();
    });

    it('should not show a gravatar when actor type is a team', function () {
      const {container} = render(
        <ActorAvatar
          actor={{
            id: '3',
            name: 'COOL TEAM',
            type: 'team',
          }}
        />
      );

      expect(screen.getByText('CT')).toBeInTheDocument();

      expect(container).toSnapshot();
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
      const organization = TestStubs.Organization();

      OrganizationStore.onUpdate(organization, {replace: true});

      const team2 = TestStubs.Team({id: '2', name: 'COOL TEAM', slug: 'cool-team'});

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

      await waitFor(() => expect(mockRequest).toHaveBeenCalled());

      expect(screen.getByText('CT')).toBeInTheDocument();
    });
  });
});
