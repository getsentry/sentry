import React from 'react';

import {mountWithTheme, mount} from 'sentry-test/enzyme';

import ActorAvatar from 'app/components/avatar/actorAvatar';
import MemberListStore from 'app/stores/memberListStore';
import TeamStore from 'app/stores/teamStore';

describe('ActorAvatar', function() {
  const USER = {
    id: '1',
    name: 'JanActore Bloggs',
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
  beforeEach(function() {
    MemberListStore.loadInitialData([USER]);
    TeamStore.loadInitialData([TEAM_1]);
  });

  afterEach(function() {});

  describe('render()', function() {
    it('should show a gravatar when actor type is a user', function() {
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

    it('should show a gravatar when actor type is a team', function() {
      const avatar = mountWithTheme(
        <ActorAvatar
          actor={{
            id: '3',
            name: 'COOL TEAM',
            type: 'team',
          }}
        />
      );
      expect(avatar).toSnapshot();
    });

    it('should return null when actor type is a unknown', function() {
      window.console.error = jest.fn();

      const avatar = mount(
        <ActorAvatar
          actor={{
            id: '3',
            name: 'COOL TEAM',
            type: 'teapot',
          }}
        />
      );

      expect(avatar.html()).toBe(null);
      //proptype warning
      expect(window.console.error.mock.calls.length).toBeGreaterThan(0);

      window.console.error.mockRestore();
    });
  });
});
