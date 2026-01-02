import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import organizationMembershipSettingsFields from 'sentry/data/forms/organizationMembershipSettings';
import OrganizationStore from 'sentry/stores/organizationStore';
import type {Organization} from 'sentry/types/organization';

import OrganizationMembershipSettingsForm from 'getsentry/hooks/organizationMembershipSettingsForm';

describe('OrganizationMembershipSettings', () => {
  const location = LocationFixture();
  let membersRequest: jest.Mock;

  const getComponent = (organization: Organization) => {
    OrganizationStore.onUpdate(organization, {replace: true});
    const access = new Set(organization.access);
    const jsonFormSettings = {
      features: new Set(organization.features),
      access,
      location,
      disabled: !access.has('org:write'),
    };
    return (
      <OrganizationMembershipSettingsForm
        jsonFormSettings={jsonFormSettings}
        forms={organizationMembershipSettingsFields}
      />
    );
  };

  beforeEach(() => {
    membersRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      body: [],
    });
  });

  it('renders alert banner and disables settings if org does not have invite-members', async () => {
    const organization = OrganizationFixture({features: [], access: []});
    render(getComponent(organization), {organization});
    await waitFor(() => expect(membersRequest).toHaveBeenCalled());
    expect(
      screen.getByText('You must be on a paid plan to invite additional members.')
    ).toBeInTheDocument();
    expect(screen.getByRole('checkbox', {name: 'Open Team Membership'})).toBeDisabled();
  });

  it('renders alert banner and disables settings if org does not have invite-members and user has org:write access', async () => {
    const organization = OrganizationFixture({features: [], access: ['org:write']});
    render(getComponent(organization), {organization});
    await waitFor(() => expect(membersRequest).toHaveBeenCalled());
    expect(
      screen.getByText('You must be on a paid plan to invite additional members.')
    ).toBeInTheDocument();
    expect(screen.getByRole('checkbox', {name: 'Open Team Membership'})).toBeDisabled();
  });

  it('does not render alert banner if org does not have invite-members', async () => {
    const organization = OrganizationFixture({features: ['invite-members'], access: []});
    render(getComponent(organization), {organization});
    await waitFor(() => expect(membersRequest).toHaveBeenCalled());
    expect(
      screen.queryByText('You must be on a paid plan to invite additional members.')
    ).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', {name: 'Open Team Membership'})).toBeDisabled();
  });

  it('does not render alert banner and enables settings if org has invite-members and user has org:write access', async () => {
    const organization = OrganizationFixture({
      features: ['invite-members'],
      access: ['org:write'],
    });
    render(getComponent(organization), {organization});
    await waitFor(() => expect(membersRequest).toHaveBeenCalled());
    expect(
      screen.queryByText('You must be on a paid plan to invite additional members.')
    ).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', {name: 'Open Team Membership'})).toBeEnabled();
  });

  it('disables default role selection if user does not have invite-members', async () => {
    const organization = OrganizationFixture({
      features: [],
      access: ['org:admin'],
    });
    render(getComponent(organization), {organization});
    await waitFor(() => expect(membersRequest).toHaveBeenCalled());
    expect(screen.getByRole('textbox', {name: 'Default Role'})).toBeDisabled();
  });

  it('disables default role selection if user does not have org:admin access', async () => {
    const organization = OrganizationFixture({
      features: ['invite-members'],
      access: ['org:write'],
    });
    render(getComponent(organization), {organization});
    await waitFor(() => expect(membersRequest).toHaveBeenCalled());
    expect(screen.getByRole('textbox', {name: 'Default Role'})).toBeDisabled();
  });

  it('enables default role selection if user does not has org:admin access', async () => {
    const organization = OrganizationFixture({
      features: ['invite-members'],
      access: ['org:write', 'org:admin'],
    });
    render(getComponent(organization), {organization});
    await waitFor(() => expect(membersRequest).toHaveBeenCalled());
    expect(screen.getByRole('textbox', {name: 'Default Role'})).toBeEnabled();
  });

  it('disables member project creation if org does not have team-roles', async () => {
    const organization = OrganizationFixture({
      features: ['invite-members'],
      access: ['org:write'],
    });
    render(getComponent(organization), {organization});
    await waitFor(() => expect(membersRequest).toHaveBeenCalled());
    expect(
      screen.getByRole('checkbox', {name: 'Let Members Create Projects'})
    ).toBeDisabled();
  });

  it('enables member project creation if org has team-roles', async () => {
    const organization = OrganizationFixture({
      features: ['invite-members', 'team-roles'],
      access: ['org:write'],
    });
    render(getComponent(organization), {organization});
    await waitFor(() => expect(membersRequest).toHaveBeenCalled());
    expect(
      screen.getByRole('checkbox', {name: 'Let Members Create Projects'})
    ).toBeEnabled();
  });

  it('disables member project creation if user does not have org:write access', async () => {
    const organization = OrganizationFixture({
      features: ['invite-members', 'team-roles'],
      access: [],
    });
    render(getComponent(organization), {organization});
    await waitFor(() => expect(membersRequest).toHaveBeenCalled());
    expect(
      screen.getByRole('checkbox', {name: 'Let Members Create Projects'})
    ).toBeDisabled();
  });

  it('does not render restrict replay access if org does not have granular-replay-permissions', async () => {
    const organization = OrganizationFixture({
      features: ['invite-members'],
      access: ['org:write'],
    });
    render(getComponent(organization), {organization});
    await waitFor(() => expect(membersRequest).toHaveBeenCalled());
    expect(
      screen.queryByRole('checkbox', {name: 'Restrict Replay Access'})
    ).not.toBeInTheDocument();
  });

  it('renders restrict replay access if org has granular-replay-permissions', async () => {
    const organization = OrganizationFixture({
      features: ['invite-members', 'granular-replay-permissions'],
      access: ['org:write'],
      hasGranularReplayPermissions: true,
    });
    render(getComponent(organization), {organization});
    await waitFor(() => expect(membersRequest).toHaveBeenCalled());
    const checkbox = screen.getByRole('checkbox', {name: 'Restrict Replay Access'});
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).toBeEnabled();
  });

  it('disables restrict replay access if user does not have org:write access', async () => {
    const organization = OrganizationFixture({
      features: ['invite-members', 'granular-replay-permissions'],
      access: [],
      hasGranularReplayPermissions: true,
    });
    render(getComponent(organization), {organization});
    await waitFor(() => expect(membersRequest).toHaveBeenCalled());
    expect(screen.getByRole('checkbox', {name: 'Restrict Replay Access'})).toBeDisabled();
  });
});
