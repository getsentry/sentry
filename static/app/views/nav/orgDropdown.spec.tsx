import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import OrganizationsStore from 'sentry/stores/organizationsStore';
import {OrgDropdown} from 'sentry/views/nav/orgDropdown';

describe('OrgDropdown', function () {
  const organization = OrganizationFixture({
    access: ['org:read', 'member:read', 'team:read'],
  });

  beforeEach(() => {
    ConfigStore.set('user', UserFixture());
  });

  it('displays org info and links', async function () {
    render(<OrgDropdown />, {organization});

    await userEvent.click(screen.getByRole('button', {name: 'Toggle organization menu'}));

    expect(screen.getByText('org-slug')).toBeInTheDocument();
    expect(screen.getByText('0 Projects')).toBeInTheDocument();

    expect(screen.getByRole('link', {name: 'Organization Settings'})).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/settings/`
    );
    expect(screen.getByRole('link', {name: 'Members'})).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/settings/members/`
    );
    expect(screen.getByRole('link', {name: 'Teams'})).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/settings/teams/`
    );
  });

  it('displays user info and links', async function () {
    render(<OrgDropdown />, {organization});

    await userEvent.click(screen.getByRole('button', {name: 'Toggle organization menu'}));

    expect(screen.getByText('Foo Bar')).toBeInTheDocument();
    expect(screen.getByText('foo@example.com')).toBeInTheDocument();

    expect(screen.getByRole('link', {name: 'User Settings'})).toHaveAttribute(
      'href',
      '/settings/account/'
    );
    expect(screen.getByRole('link', {name: 'User Auth Tokens'})).toHaveAttribute(
      'href',
      '/settings/account/api/'
    );
  });

  it('can sign out', async function () {
    const mockLogout = MockApiClient.addMockResponse({
      url: '/auth/',
      method: 'DELETE',
    });

    render(<OrgDropdown />, {organization});

    await userEvent.click(screen.getByRole('button', {name: 'Toggle organization menu'}));

    await userEvent.click(screen.getByText('Sign Out'));

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled();
    });
  });

  it('hides admin link if user is not admin', async function () {
    render(<OrgDropdown />, {organization});

    await userEvent.click(screen.getByRole('button', {name: 'Toggle organization menu'}));

    expect(screen.queryByRole('link', {name: 'Admin'})).not.toBeInTheDocument();
  });

  it('shows admin link if user is admin', async function () {
    ConfigStore.set('user', UserFixture({isSuperuser: true}));

    render(<OrgDropdown />, {organization});

    await userEvent.click(screen.getByRole('button', {name: 'Toggle organization menu'}));

    expect(screen.getByRole('link', {name: 'Admin'})).toHaveAttribute('href', `/manage/`);
  });

  it('can switch orgs', async function () {
    OrganizationsStore.addOrReplace(
      OrganizationFixture({id: '1', name: 'Org 1', slug: 'org-1'})
    );
    OrganizationsStore.addOrReplace(
      OrganizationFixture({id: '2', name: 'Org 2', slug: 'org-2'})
    );

    render(<OrgDropdown />, {organization});

    await userEvent.click(screen.getByRole('button', {name: 'Toggle organization menu'}));

    await userEvent.hover(screen.getByText('Switch Organization'));

    expect(await screen.findByRole('link', {name: /org-1/})).toHaveAttribute(
      'href',
      `/organizations/org-1/issues/`
    );
    expect(await screen.findByRole('link', {name: /org-2/})).toHaveAttribute(
      'href',
      `/organizations/org-2/issues/`
    );
  });
});
