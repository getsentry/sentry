import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import organizationMembershipSettingsFields from 'sentry/data/forms/organizationMembershipSettings';
import type {Organization} from 'sentry/types/organization';

import OrganizationMembershipSettingsForm from 'getsentry/hooks/organizationMembershipSettingsForm';

describe('OrganizationMembershipSettings', function () {
  const location = LocationFixture();
  const getComponent = (organization: Organization) => {
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

  it('renders alert banner and disables settings if org does not have invite-members', function () {
    const organization = OrganizationFixture({features: [], access: []});
    render(getComponent(organization), {organization});
    expect(
      screen.getByText('You must be on a paid plan to invite additional members.')
    ).toBeInTheDocument();
    expect(screen.getByRole('checkbox', {name: 'Open Team Membership'})).toBeDisabled();
  });

  it('renders alert banner and disables settings if org does not have invite-members and user has org:write access', function () {
    const organization = OrganizationFixture({features: [], access: ['org:write']});
    render(getComponent(organization), {organization});
    expect(
      screen.getByText('You must be on a paid plan to invite additional members.')
    ).toBeInTheDocument();
    expect(screen.getByRole('checkbox', {name: 'Open Team Membership'})).toBeDisabled();
  });

  it('does not render alert banner if org does not have invite-members', function () {
    const organization = OrganizationFixture({features: ['invite-members'], access: []});
    render(getComponent(organization), {organization});
    expect(
      screen.queryByText('You must be on a paid plan to invite additional members.')
    ).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', {name: 'Open Team Membership'})).toBeDisabled();
  });

  it('does not render alert banner and enables settings if org has invite-members and user has org:write access', function () {
    const organization = OrganizationFixture({
      features: ['invite-members'],
      access: ['org:write'],
    });
    render(getComponent(organization), {organization});
    expect(
      screen.queryByText('You must be on a paid plan to invite additional members.')
    ).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', {name: 'Open Team Membership'})).toBeEnabled();
  });

  it('disables default role selection if user does not have invite-members', function () {
    const organization = OrganizationFixture({
      features: [],
      access: ['org:admin'],
    });
    render(getComponent(organization), {organization});
    expect(screen.getByRole('textbox', {name: 'Default Role'})).toBeDisabled();
  });

  it('disables default role selection if user does not have org:admin access', function () {
    const organization = OrganizationFixture({
      features: ['invite-members'],
      access: ['org:write'],
    });
    render(getComponent(organization), {organization});
    expect(screen.getByRole('textbox', {name: 'Default Role'})).toBeDisabled();
  });

  it('enables default role selection if user does not has org:admin access', function () {
    const organization = OrganizationFixture({
      features: ['invite-members'],
      access: ['org:write', 'org:admin'],
    });
    render(getComponent(organization), {organization});
    expect(screen.getByRole('textbox', {name: 'Default Role'})).toBeEnabled();
  });

  it('disables member project creation if org does not have team-roles', function () {
    const organization = OrganizationFixture({
      features: ['invite-members'],
      access: ['org:write'],
    });
    render(getComponent(organization), {organization});
    expect(
      screen.getByRole('checkbox', {name: 'Let Members Create Projects'})
    ).toBeDisabled();
  });

  it('enables member project creation if org has team-roles', function () {
    const organization = OrganizationFixture({
      features: ['invite-members', 'team-roles'],
      access: ['org:write'],
    });
    render(getComponent(organization), {organization});
    expect(
      screen.getByRole('checkbox', {name: 'Let Members Create Projects'})
    ).toBeEnabled();
  });

  it('disables member project creation if user does not have org:write access', function () {
    const organization = OrganizationFixture({
      features: ['invite-members', 'team-roles'],
      access: [],
    });
    render(getComponent(organization), {organization});
    expect(
      screen.getByRole('checkbox', {name: 'Let Members Create Projects'})
    ).toBeDisabled();
  });
});
