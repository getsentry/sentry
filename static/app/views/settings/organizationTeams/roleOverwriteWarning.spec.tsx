import {OrgRoleListFixture, TeamRoleListFixture} from 'sentry-fixture/roleList';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {
  hasOrgRoleOverwrite,
  RoleOverwritePanelAlert,
} from 'sentry/views/settings/organizationTeams/roleOverwriteWarning';

describe('roleOverwriteWarning', () => {
  describe('hasOrgRoleOverwrite', () => {
    it('returns true when the org role grants an elevated team role', () => {
      expect(
        hasOrgRoleOverwrite({
          orgRole: 'manager',
          orgRoleList: OrgRoleListFixture(),
          teamRoleList: TeamRoleListFixture(),
        })
      ).toBe(true);
    });

    it('returns false when the org role grants the lowest team role', () => {
      expect(
        hasOrgRoleOverwrite({
          orgRole: 'member',
          orgRoleList: OrgRoleListFixture(),
          teamRoleList: TeamRoleListFixture(),
        })
      ).toBe(false);
    });

    it('returns false when role lists are missing', () => {
      expect(
        hasOrgRoleOverwrite({
          orgRole: 'manager',
          orgRoleList: undefined,
          teamRoleList: undefined,
        })
      ).toBe(false);
      expect(
        hasOrgRoleOverwrite({
          orgRole: 'manager',
          orgRoleList: OrgRoleListFixture(),
          teamRoleList: undefined,
        })
      ).toBe(false);
    });
  });

  describe('RoleOverwritePanelAlert', () => {
    it('renders nothing when role lists are missing', () => {
      render(
        <RoleOverwritePanelAlert
          orgRole="manager"
          orgRoleList={undefined}
          teamRoleList={undefined}
          isSelf
        />
      );
      expect(screen.queryByTestId('alert-role-overwrite')).not.toBeInTheDocument();
    });

    it('renders the alert when the org role overrides the team role', () => {
      render(
        <RoleOverwritePanelAlert
          orgRole="manager"
          orgRoleList={OrgRoleListFixture()}
          teamRoleList={TeamRoleListFixture()}
          isSelf
        />
      );
      expect(screen.getByTestId('alert-role-overwrite')).toBeInTheDocument();
    });
  });
});
