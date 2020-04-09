import React from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme} from 'sentry-test/enzyme';
import {openCreateTeamModal} from 'app/actionCreators/modal';
import OrganizationTeams from 'app/views/settings/organizationTeams';
import recreateRoute from 'app/utils/recreateRoute';

recreateRoute.mockReturnValue('');

jest.mock('app/actionCreators/modal', () => ({
  openCreateTeamModal: jest.fn(),
}));

describe('OrganizationTeams', function() {
  beforeEach(function() {
    MockApiClient.clearMockResponses();
  });

  describe('Open Membership', function() {
    const {organization, project, routerContext} = initializeOrg({
      organization: {
        features: ['open-membership'],
        access: ['project:admin'],
      },
    });

    const createWrapper = props =>
      mountWithTheme(
        <OrganizationTeams
          params={{orgId: organization.slug, projectId: project.slug}}
          routes={[]}
          organization={organization}
          {...props}
        />,
        routerContext
      );

    it('opens "create team modal" when creating a new team from header', async function() {
      MockApiClient.addMockResponse({
        url: `/organizations/org-slug/teams/`,
        body: [],
      });
      MockApiClient.addMockResponse({
        url: `/organizations/org-slug/user-teams/`,
        body: [],
      });

      const wrapper = createWrapper();

      // Click "Create Team" in Panel Header
      wrapper.find('SettingsPageHeading Button').simulate('click');

      // action creator to open "create team modal" is called
      expect(openCreateTeamModal).toHaveBeenCalledWith(
        expect.objectContaining({
          organization: expect.objectContaining({
            slug: organization.slug,
          }),
        })
      );
    });

    it('can join team and have link to details', async function() {
      const team = TestStubs.Team({hasAccess: true, isMember: false});
      MockApiClient.addMockResponse({
        url: `/organizations/org-slug/teams/`,
        body: [team],
      });
      MockApiClient.addMockResponse({
        url: `/organizations/org-slug/user-teams/`,
        body: [],
      });

      const join = MockApiClient.addMockResponse({
        url: `/organizations/org-slug/members/me/teams/${team.slug}/`,
        method: 'POST',
        body: {...team, isMember: true},
      });

      const wrapper = createWrapper({
        organization: {
          ...organization,
          access: [],
        },
      });

      await tick();
      wrapper.update();
      expect(wrapper.find('button[aria-label="Join Team"]')).toHaveLength(1);

      // Should also link to details
      expect(wrapper.find('Link')).toHaveLength(1);

      wrapper.find('button[aria-label="Join Team"]').simulate('click');

      expect(join).toHaveBeenCalled();

      await tick();
      wrapper.update();
      expect(wrapper.find('button[aria-label="Join Team"]')).toHaveLength(0);
      expect(wrapper.find('button[aria-label="Leave Team"]')).toHaveLength(1);
    });
  });

  describe('Closed Membership', function() {
    const {organization, project, routerContext} = initializeOrg({
      organization: {
        features: [],
        access: [],
      },
    });
    const createWrapper = props =>
      mountWithTheme(
        <OrganizationTeams
          params={{orgId: organization.slug, projectId: project.slug}}
          routes={[]}
          organization={organization}
          {...props}
        />,
        routerContext
      );

    it('can request access to team and does not have link to details', async function() {
      const team = TestStubs.Team({hasAccess: false, isMember: false});
      MockApiClient.addMockResponse({
        url: `/organizations/org-slug/teams/`,
        body: [team],
      });
      MockApiClient.addMockResponse({
        url: `/organizations/org-slug/user-teams/`,
        body: [],
      });

      const requestAccess = MockApiClient.addMockResponse({
        url: `/organizations/org-slug/members/me/teams/${team.slug}/`,
        method: 'POST',
        body: {...team, isPending: true},
      });

      const wrapper = createWrapper();
      await tick();
      wrapper.update();

      expect(wrapper.find('button[aria-label="Request Access"]')).toHaveLength(1);

      // Should also not link to details because of lack of access
      expect(wrapper.find('Link')).toHaveLength(0);

      // Request access
      wrapper.find('button[aria-label="Request Access"]').simulate('click');

      expect(requestAccess).toHaveBeenCalled();

      await tick();
      wrapper.update();

      // Button becomes "Request Pending" and should be disabled
      expect(
        wrapper.find('button[aria-label="Request Pending"][aria-disabled=true]')
      ).toHaveLength(1);
    });

    it('can leave team when you are a member', async function() {
      const team = TestStubs.Team({hasAccess: true, isMember: true});
      MockApiClient.addMockResponse({
        url: `/organizations/org-slug/teams/`,
        body: [],
      });
      MockApiClient.addMockResponse({
        url: `/organizations/org-slug/user-teams/`,
        body: [team],
      });

      const leaveTeam = MockApiClient.addMockResponse({
        url: `/organizations/org-slug/members/me/teams/${team.slug}/`,
        method: 'DELETE',
        body: {...team, isMember: false, hasAccess: true},
      });

      const wrapper = createWrapper();
      await tick();
      wrapper.update();

      expect(wrapper.find('button[aria-label="Leave Team"]')).toHaveLength(1);

      wrapper.find('button[aria-label="Leave Team"]').simulate('click');
      await tick();
      wrapper.update();

      expect(leaveTeam).toHaveBeenCalled();

      expect(wrapper.find('button[aria-label="Leave Team"]')).toHaveLength(0);
    });

    it('searches for other teams', async function() {
      const teamsMock = MockApiClient.addMockResponse({
        url: `/organizations/org-slug/teams/`,
        body: [TestStubs.Team({hasAccess: true, isMember: true})],
      });
      MockApiClient.addMockResponse({
        url: `/organizations/org-slug/user-teams/`,
        body: [],
      });

      const wrapper = createWrapper();
      await tick();
      wrapper.update();

      expect(teamsMock).toHaveBeenCalledTimes(1);
      expect(teamsMock).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({query: undefined}),
        })
      );

      wrapper
        .find('input[name="teamSearch"]')
        .simulate('change', {target: {value: 'te'}});

      expect(teamsMock).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({query: 'te'}),
        })
      );
    });
  });
});
