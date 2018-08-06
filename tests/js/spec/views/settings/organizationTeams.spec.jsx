import React from 'react';
import {mount} from 'enzyme';

import OrganizationTeams from 'app/views/settings/organizationTeams/organizationTeams';
import {openCreateTeamModal} from 'app/actionCreators/modal';
import recreateRoute from 'app/utils/recreateRoute';

recreateRoute.mockReturnValue('');

jest.mock('app/actionCreators/modal', () => ({
  openCreateTeamModal: jest.fn(),
}));

describe('OrganizationTeams', function() {
  let org = TestStubs.Organization();
  let project = TestStubs.Project();
  beforeEach(function() {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/stats/',
      body: [],
    });
  });

  it('opens "create team modal" when creating a new team from header', function() {
    let wrapper = mount(
      <OrganizationTeams
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
