import {mountWithTheme} from 'sentry-test/enzyme';
import {act} from 'sentry-test/reactTestingLibrary';

import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import MemberListStore from 'sentry/stores/memberListStore';
import OrganizationStore from 'sentry/stores/organizationStore';
import TeamStore from 'sentry/stores/teamStore';

describe('ActorAvatar', function () {
  const USER = {
    id: '1',
    name: 'Jane Bloggs',
    email: 'janebloggs@example.com',
  };
  const TEAM_1 = {
    id: '3',
    slug: 'cool-team',
    name: 'COOL TEAM',
    projects: [
      {
        slug: 2,
      },
    ],
  };
  const org = TestStubs.Organization();
  OrganizationStore.onUpdate(org, {replace: true});
  beforeEach(function () {
    MemberListStore.loadInitialData([USER]);
    act(() => void TeamStore.loadInitialData([TEAM_1]));
  });

  afterEach(function () {});

  describe('render()', function () {
    it('should show a gravatar when actor type is a user', function () {
      const avatar = mountWithTheme(
        <ActorAvatar
          actor={{
            id: '1',
            name: 'Jane Bloggs',
            type: 'user',
          }}
        />
      );
      expect(avatar).toSnapshot();
    });

    it('should not show a gravatar when actor type is a team', function () {
      const avatar = mountWithTheme(
        <ActorAvatar
          actor={{
            id: '3',
            name: 'COOL TEAM',
            type: 'team',
          }}
        />
      );
      expect(avatar.find('LetterAvatar')).toHaveLength(1);
      expect(avatar.find('Gravatar')).toHaveLength(0);
      expect(avatar).toSnapshot();
    });

    it('should return null when actor type is a unknown', function () {
      const avatar = mountWithTheme(
        <ActorAvatar
          actor={{
            id: '3',
            name: 'COOL TEAM',
            type: 'teapot',
          }}
        />
      );

      expect(avatar.html()).toBe(null);
    });

    it('should fetch a team not in the store', async function () {
      const team2 = TestStubs.Team({id: '2'});

      const mockRequest = MockApiClient.addMockResponse({
        url: `/organizations/${org.slug}/teams/`,
        method: 'GET',
        body: [team2],
      });

      const avatar = mountWithTheme(
        <ActorAvatar
          actor={{
            id: '2',
            name: 'COOL TEAM',
            type: 'team',
          }}
        />
      );

      expect(mockRequest).toHaveBeenCalled();

      await act(() => tick());
      avatar.update();

      expect(avatar.find('LetterAvatar')).toHaveLength(1);
    });
  });
});
