import {MemberFixture} from 'sentry-fixture/member';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {openInviteMembersModal} from 'sentry/actionCreators/modal';
import OrganizationMembersList from 'sentry/views/settings/organizationMembers/organizationMembersList';
import OrganizationMembersWrapper from 'sentry/views/settings/organizationMembers/organizationMembersWrapper';

jest.mock('sentry/utils/analytics');
jest.mock('sentry/actionCreators/modal', () => ({
  openInviteMembersModal: jest.fn(),
}));

describe('OrganizationMembersWrapper', function () {
  const {routerProps} = initializeOrg();

  const member = MemberFixture();
  const organization = OrganizationFixture({
    features: ['invite-members'],
    access: ['member:admin', 'org:admin', 'member:write'],
    status: {
      id: 'active',
      name: 'active',
    },
  });

  beforeEach(function () {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/me/',
      method: 'GET',
      body: {roles: []},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/invite-requests/',
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/access-requests/',
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/auth-provider/',
      method: 'GET',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/missing-members/',
      method: 'GET',
      body: [],
    });
  });

  it('can invite member', async function () {
    render(<OrganizationMembersWrapper organization={organization} {...routerProps} />);

    await userEvent.click(screen.getByRole('button', {name: 'Invite Members'}));
    expect(openInviteMembersModal).toHaveBeenCalled();
  });

  it('can not invite members without the invite-members feature', function () {
    const org = OrganizationFixture({
      features: [],
      access: ['member:admin', 'org:admin', 'member:write'],
      status: {
        id: 'active',
        name: 'active',
      },
    });
    render(<OrganizationMembersWrapper organization={org} {...routerProps} />);

    expect(screen.getByRole('button', {name: 'Invite Members'})).toBeDisabled();
  });

  it('cannot invite members if SSO is required', async function () {
    const org = OrganizationFixture({
      features: ['invite-members'],
      access: [],
      status: {
        id: 'active',
        name: 'active',
      },
      requiresSso: true,
    });

    render(<OrganizationMembersWrapper organization={org} {...routerProps} />);

    await userEvent.click(screen.getByRole('button', {name: 'Invite Members'}));
    expect(openInviteMembersModal).not.toHaveBeenCalled();
  });

  it('can invite without permissions', async function () {
    const org = OrganizationFixture({
      features: ['invite-members'],
      access: [],
      status: {
        id: 'active',
        name: 'active',
      },
    });

    render(<OrganizationMembersWrapper organization={org} {...routerProps} />);

    await userEvent.click(screen.getByRole('button', {name: 'Invite Members'}));
    expect(openInviteMembersModal).toHaveBeenCalled();
  });

  it('renders member list', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      method: 'GET',
      body: [member],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/prompts-activity/',
      method: 'GET',
      body: {},
    });
    render(
      <OrganizationMembersWrapper organization={organization} {...routerProps}>
        <OrganizationMembersList {...routerProps} />
      </OrganizationMembersWrapper>
    );

    expect(await screen.findByText('Members')).toBeInTheDocument();
    expect(screen.getByText(member.name)).toBeInTheDocument();
  });
});
