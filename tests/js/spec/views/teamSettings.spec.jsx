import PropTypes from 'prop-types';
import React from 'react';
import {mount, shallow} from 'enzyme';

import TeamSettings from 'app/views/settings/team/teamSettings.old';
import NewTeamSettings from 'app/views/settings/team/teamSettings';

const childContextTypes = {
  organization: PropTypes.object,
  router: PropTypes.object,
  location: PropTypes.object,
};

// #NEW-SETTINGS
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

describe('NewTeamSettings', function() {
  beforeEach(function() {
    MockApiClient.clearMockResponses();
    sinon.stub(window.location, 'assign');
  });

  afterEach(function() {
    window.location.assign.restore();
  });

  it('can change name and slug', function(done) {
    let team = TestStubs.Team();
    let putMock = MockApiClient.addMockResponse({
      url: `/teams/org/${team.slug}/`,
      method: 'PUT',
    });

    let wrapper = mount(
      <NewTeamSettings
        routes={[]}
        params={{orgId: 'org', teamId: team.slug}}
        team={team}
        onTeamChange={() => {}}
      />,
      TestStubs.routerContext()
    );

    wrapper
      .find('input[name="name"]')
      .simulate('change', {target: {value: 'New Name'}})
      .simulate('blur');

    expect(putMock).toHaveBeenCalledWith(
      `/teams/org/${team.slug}/`,
      expect.objectContaining({
        data: {
          name: 'New Name',
        },
      })
    );

    wrapper
      .find('input[name="slug"]')
      .simulate('change', {target: {value: 'new-slug'}})
      .simulate('blur');

    expect(putMock).toHaveBeenCalledWith(
      `/teams/org/${team.slug}/`,
      expect.objectContaining({
        data: {
          slug: 'new-slug',
        },
      })
    );

    setTimeout(() => {
      expect(
        window.location.assign.calledWith(
          '/settings/organization/org/teams/new-slug/settings/'
        )
      ).toBe(true);
      done();
    }, 1);
  });
});
