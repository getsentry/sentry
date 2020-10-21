import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme} from 'sentry-test/enzyme';

import {openCreateTeamModal} from 'app/actionCreators/modal';
import OrganizationTeams from 'app/views/settings/organizationTeams/organizationTeams';
import recreateRoute from 'app/utils/recreateRoute';

recreateRoute.mockReturnValue('');

jest.mock('app/actionCreators/modal', () => ({
  openCreateTeamModal: jest.fn(),
}));

describe('OrganizationTeams', function () {
  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/stats/',
      body: [],
    });
  });

  describe('Open Membership', function () {
    const {organization, project, routerContext} = initializeOrg({
      organization: {
        openMembership: true,
      },
    });
    const teams = [TestStubs.Team()];

    const createWrapper = props =>
      mountWithTheme(
        <OrganizationTeams
          params={{orgId: organization.slug, projectId: project.slug}}
          routes={[]}
          features={new Set(['open-membership'])}
          access={new Set(['project:admin'])}
          allTeams={teams}
          activeTeams={[]}
          organization={organization}
          {...props}
        />,
        routerContext
      );

    it('opens "create team modal" when creating a new team from header', async function () {
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

    it('can join team and have link to details', function () {
      const wrapper = createWrapper({
        allTeams: [TestStubs.Team({hasAccess: true, isMember: false})],
        access: new Set([]),
      });
      expect(wrapper.find('button[aria-label="Join Team"]')).toHaveLength(1);

      // Should also link to details
      expect(wrapper.find('Link')).toHaveLength(1);
    });
  });

  describe('Closed Membership', function () {
    const {organization, project, routerContext} = initializeOrg({
      organization: {
        openMembership: false,
      },
    });
    const createWrapper = props =>
      mountWithTheme(
        <OrganizationTeams
          params={{orgId: organization.slug, projectId: project.slug}}
          routes={[]}
          features={new Set([])}
          access={new Set([])}
          allTeams={[]}
          activeTeams={[]}
          organization={organization}
          {...props}
        />,
        routerContext
      );

    it('can request access to team and does not have link to details', function () {
      const wrapper = createWrapper({
        allTeams: [TestStubs.Team({hasAccess: false, isMember: false})],
        access: new Set([]),
      });
      expect(wrapper.find('button[aria-label="Request Access"]')).toHaveLength(1);

      // Should also not link to details because of lack of access
      expect(wrapper.find('Link')).toHaveLength(0);
    });

    it('can leave team when you are a member', function () {
      const wrapper = createWrapper({
        allTeams: [TestStubs.Team({hasAccess: true, isMember: true})],
        access: new Set([]),
      });
      expect(wrapper.find('button[aria-label="Leave Team"]')).toHaveLength(1);
    });
  });
});
