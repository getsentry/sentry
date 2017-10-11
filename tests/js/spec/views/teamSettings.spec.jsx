import React from 'react';
import {shallow} from 'enzyme';

import TeamSettings from 'app/views/settings/team/teamSettings.old';

const childContextTypes = {
  organization: React.PropTypes.object,
  router: React.PropTypes.object,
  location: React.PropTypes.object,
};

describe('TeamSettings', function() {
  describe('render()', function() {
    it('renders', function() {
      let team = TestStubs.Team();
      let wrapper = shallow(
        <TeamSettings
          routes={[]}
          params={{orgId: 'org', teamId: team.slug}}
          team={team}
          onTeamChange={() => {}}
        />,
        {
          context: {
            router: TestStubs.router(),
          },
          childContextTypes,
        }
      );

      wrapper.update();
      expect(wrapper).toMatchSnapshot();
    });
  });
});
