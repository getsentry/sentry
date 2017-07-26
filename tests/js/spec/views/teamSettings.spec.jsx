import React from 'react';
import {shallow} from 'enzyme';
import toJson from 'enzyme-to-json';

import TeamSettings from 'app/views/teamSettings';

describe('TeamSettings', function() {
  describe('render()', function() {
    it('renders', function() {
      let team = TestStubs.Team();
      let wrapper = shallow(
        <TeamSettings
          params={{orgId: 'org', teamId: team.slug}}
          team={team}
          onTeamChange={() => {}}
        />,
        {
          context: {
            router: TestStubs.router()
          }
        }
      );
      expect(toJson(wrapper)).toMatchSnapshot();
    });
  });
});
