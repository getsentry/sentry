import React from 'react';
import {shallow, mount} from 'enzyme';
import ActorAvatar from 'app/components/actorAvatar';
import MemberListStore from 'app/stores/memberListStore';
import TeamStore from 'app/stores/teamStore';

describe('Avatar', function() {
  let sandbox;

  const USER = {
    id: '1',
    name: 'Jane Doe',
    email: 'janedoe@example.com',
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
    sandbox = sinon.sandbox.create();
    MemberListStore.loadInitialData([USER]);
    TeamStore.loadInitialData([TEAM_1]);
  });

  afterEach(function() {
    sandbox.restore();
  });

  describe('render()', function() {
    it('should show a gravatar when actor type is a user', function() {
      let avatar = shallow(
        <ActorAvatar
          actor={{
            id: '1',
            name: 'Jane Doe',
            type: 'user',
          }}
        />
      );
      expect(avatar).toMatchSnapshot();
    });

    it('should show a gravatar when actor type is a team', function() {
      let avatar = shallow(
        <ActorAvatar
          actor={{
            id: '3',
            name: 'COOL TEAM',
            type: 'team',
          }}
        />
      );
      expect(avatar).toMatchSnapshot();
    });

    it('should return null when actor type is a unknown', function() {
      window.console.error = jest.genMockFunction();

      let avatar = mount(
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
    });
  });
});
