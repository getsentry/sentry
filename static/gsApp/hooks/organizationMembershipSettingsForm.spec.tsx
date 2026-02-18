import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import OrganizationStore from 'sentry/stores/organizationStore';
import type {Organization} from 'sentry/types/organization';

import OrganizationMembershipSettingsForm from 'getsentry/hooks/organizationMembershipSettingsForm';

describe('OrganizationMembershipSettings', () => {
  const onSave = jest.fn();

  const renderComponent = (organization: Organization) => {
    OrganizationStore.onUpdate(organization, {replace: true});
    return render(
      <OrganizationMembershipSettingsForm organization={organization} onSave={onSave} />,
      {organization}
    );
  };

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      body: [],
    });
  });

  it('renders alert banner and disables settings if org does not have invite-members', () => {
    const organization = OrganizationFixture({features: [], access: []});
    renderComponent(organization);
    expect(
      screen.getByText('You must be on a paid plan to invite additional members.')
    ).toBeInTheDocument();
    expect(screen.getByRole('checkbox', {name: 'Open Team Membership'})).toBeDisabled();
  });

  it('renders alert banner and disables settings if org does not have invite-members and user has org:write access', () => {
    const organization = OrganizationFixture({features: [], access: ['org:write']});
    renderComponent(organization);
    expect(
      screen.getByText('You must be on a paid plan to invite additional members.')
    ).toBeInTheDocument();
    expect(screen.getByRole('checkbox', {name: 'Open Team Membership'})).toBeDisabled();
  });

  it('does not render alert banner if org has invite-members', () => {
    const organization = OrganizationFixture({features: ['invite-members'], access: []});
    renderComponent(organization);
    expect(
      screen.queryByText('You must be on a paid plan to invite additional members.')
    ).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', {name: 'Open Team Membership'})).toBeDisabled();
  });

  it('does not render alert banner and enables settings if org has invite-members and user has org:write access', () => {
    const organization = OrganizationFixture({
      features: ['invite-members'],
      access: ['org:write'],
    });
    renderComponent(organization);
    expect(
      screen.queryByText('You must be on a paid plan to invite additional members.')
    ).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', {name: 'Open Team Membership'})).toBeEnabled();
  });

  it('disables default role selection if user does not have invite-members', () => {
    const organization = OrganizationFixture({
      features: [],
      access: ['org:admin'],
    });
    renderComponent(organization);
    expect(screen.getByRole('textbox', {name: 'Default Role'})).toBeDisabled();
  });

  it('disables default role selection if user does not have org:admin access', () => {
    const organization = OrganizationFixture({
      features: ['invite-members'],
      access: ['org:write'],
    });
    renderComponent(organization);
    expect(screen.getByRole('textbox', {name: 'Default Role'})).toBeDisabled();
  });

  it('enables default role selection if user has org:admin access', () => {
    const organization = OrganizationFixture({
      features: ['invite-members'],
      access: ['org:write', 'org:admin'],
    });
    renderComponent(organization);
    expect(screen.getByRole('textbox', {name: 'Default Role'})).toBeEnabled();
  });

  it('disables member project creation if org does not have team-roles', () => {
    const organization = OrganizationFixture({
      features: ['invite-members'],
      access: ['org:write'],
    });
    renderComponent(organization);
    expect(
      screen.getByRole('checkbox', {name: 'Let Members Create Projects'})
    ).toBeDisabled();
  });

  it('enables member project creation if org has team-roles', () => {
    const organization = OrganizationFixture({
      features: ['invite-members', 'team-roles'],
      access: ['org:write'],
    });
    renderComponent(organization);
    expect(
      screen.getByRole('checkbox', {name: 'Let Members Create Projects'})
    ).toBeEnabled();
  });

  it('disables member project creation if user does not have org:write access', () => {
    const organization = OrganizationFixture({
      features: ['invite-members', 'team-roles'],
      access: [],
    });
    renderComponent(organization);
    expect(
      screen.getByRole('checkbox', {name: 'Let Members Create Projects'})
    ).toBeDisabled();
  });

  it('does not render restrict replay access if org does not have granular-replay-permissions', () => {
    const organization = OrganizationFixture({
      features: ['invite-members'],
      access: ['org:write'],
    });
    renderComponent(organization);
    expect(
      screen.queryByRole('checkbox', {name: 'Restrict Replay Access'})
    ).not.toBeInTheDocument();
  });

  it('renders restrict replay access if org has granular-replay-permissions', () => {
    const organization = OrganizationFixture({
      features: ['invite-members', 'granular-replay-permissions'],
      access: ['org:write'],
      hasGranularReplayPermissions: true,
    });
    renderComponent(organization);
    const checkbox = screen.getByRole('checkbox', {name: 'Restrict Replay Access'});
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).toBeEnabled();
  });

  it('disables restrict replay access if user does not have org:write access', () => {
    const organization = OrganizationFixture({
      features: ['invite-members', 'granular-replay-permissions'],
      access: [],
      hasGranularReplayPermissions: true,
    });
    renderComponent(organization);
    expect(screen.getByRole('checkbox', {name: 'Restrict Replay Access'})).toBeDisabled();
  });
});
