import {MemberFixture} from 'sentry-fixture/member';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {TeamFixture} from 'sentry-fixture/team';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {TeamRoleSelect} from 'sentry/components/teamRoleSelect';

describe('TeamRoleSelect', () => {
  it('renders the team role select', () => {
    render(
      <TeamRoleSelect
        organization={OrganizationFixture({features: ['team-roles']})}
        team={TeamFixture()}
        member={{...MemberFixture({orgRole: 'member'}), teamRole: 'contributor'}}
        onChangeTeamRole={jest.fn()}
      />
    );

    expect(screen.getByText('Contributor')).toBeInTheDocument();
  });

  it('renders nothing when the organization has no role lists', () => {
    const organization = OrganizationFixture();
    // The summary organization payload omits role lists
    // @ts-expect-error simulating a payload without orgRoleList
    organization.orgRoleList = undefined;
    // @ts-expect-error simulating a payload without teamRoleList
    organization.teamRoleList = undefined;

    const {container} = render(
      <TeamRoleSelect
        organization={organization}
        team={TeamFixture()}
        member={{...MemberFixture({orgRole: 'member'}), teamRole: 'contributor'}}
        onChangeTeamRole={jest.fn()}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
