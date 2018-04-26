import React from 'react';
import {mount, shallow} from 'enzyme';

import {Client} from 'app/api';
import OrganizationTeams from 'app/views/organizationTeams';
import OrganizationTeamsView from 'app/views/settings/team/organizationTeamsView';
import {openCreateTeamModal} from 'app/actionCreators/modal';
import recreateRoute from 'app/utils/recreateRoute';

recreateRoute.mockReturnValue('');

jest.mock('app/actionCreators/modal', () => ({
  openCreateTeamModal: jest.fn(),
}));

describe('OrganizationTeams', function() {
  let org = TestStubs.Organization();
  let project = TestStubs.Project();
  let sandbox;
  let stubbedApiRequest;

  beforeEach(function() {
    sandbox = sinon.sandbox.create();

    stubbedApiRequest = sandbox.stub(Client.prototype, 'request');
  });

  afterEach(function() {
    sandbox.restore();
  });

  describe('fetchStats()', function() {
    it('should make a request to the organizations endpoint', function() {
      let organizationTeams = shallow(<OrganizationTeams params={{orgId: '123'}} />, {
        organization: {id: '1337'},
      }).instance();

      // NOTE: creation of OrganizationTeams causes a bunch of API requests to fire ...
      //       reset the request stub so that we can get an accurate count
      stubbedApiRequest.reset();

      organizationTeams.fetchStats();

      expect(stubbedApiRequest.callCount).toEqual(1);
      expect(stubbedApiRequest.getCall(0).args[0]).toEqual('/organizations/123/stats/');
    });
  });

  describe('New Settings', function() {
    it('opens "create team modal" when creating a new team from header', function() {
      let wrapper = mount(
        <OrganizationTeamsView
          params={{orgId: org.slug, projectId: project.slug}}
          routes={[]}
          allTeams={[TestStubs.Team()]}
          access={new Set(['org:write'])}
          features={new Set([])}
          activeTeams={[]}
          organization={org}
        />,
        TestStubs.routerContext()
      );

      // Click "Create Team" in Panel Header
      wrapper.find('SettingsPageHeading Button').simulate('click');

      // action creator to open "create team modal" is called
      expect(openCreateTeamModal).toHaveBeenCalledWith(
        expect.objectContaining({
          organization: expect.objectContaining({
            slug: org.slug,
          }),
        })
      );
    });
  });
});
