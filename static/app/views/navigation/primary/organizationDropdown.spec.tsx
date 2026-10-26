import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {CUSTOM_REFERRER_KEY} from 'sentry/constants';
import {ConfigStore} from 'sentry/stores/configStore';
import {OrganizationsStore} from 'sentry/stores/organizationsStore';
import {readStorageValue} from 'sentry/utils/useSessionStorage';
import {OrganizationDropdown} from 'sentry/views/navigation/primary/organizationDropdown';

describe('OrganizationDropdown', () => {
  const organization = OrganizationFixture({
    access: ['org:read', 'member:read', 'team:read'],
  });

  beforeEach(() => {
    ConfigStore.set('user', UserFixture());
  });

  it('displays org info and links', async () => {
    render(<OrganizationDropdown />, {organization});

    await userEvent.click(screen.getByRole('button', {name: 'Toggle organization menu'}));

    expect(screen.getByText('Organization Name')).toBeInTheDocument();
    expect(screen.getByText('0 Projects')).toBeInTheDocument();

    expect(
      screen.getByRole('menuitemradio', {name: 'Organization Settings'})
    ).toHaveAttribute('href', `/settings/${organization.slug}/`);
    expect(screen.getByRole('menuitemradio', {name: 'Members'})).toHaveAttribute(
      'href',
      `/settings/${organization.slug}/members/`
    );
    expect(screen.getByRole('menuitemradio', {name: 'Teams'})).toHaveAttribute(
      'href',
      `/settings/${organization.slug}/teams/`
    );
  });

  it('shows the shared header in the settings v3 menu', async () => {
    render(<OrganizationDropdown />, {
      organization: OrganizationFixture({
        ...organization,
        features: ['settings-v3'],
      }),
    });

    await userEvent.click(screen.getByRole('button', {name: 'Toggle organization menu'}));

    expect(screen.getByText('Organization')).toBeInTheDocument();
    expect(screen.getAllByText('Organization Name')).toHaveLength(1);
    expect(screen.getByText('0 Projects')).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', {name: 'Settings'})).toBeInTheDocument();
  });

  it('can switch orgs', async () => {
    OrganizationsStore.addOrReplace(
      OrganizationFixture({id: '1', name: 'Org 1', slug: 'org-1'})
    );
    OrganizationsStore.addOrReplace(
      OrganizationFixture({id: '2', name: 'Org 2', slug: 'org-2'})
    );

    render(<OrganizationDropdown />, {organization});

    await userEvent.click(screen.getByRole('button', {name: 'Toggle organization menu'}));
    await userEvent.hover(screen.getByText('Switch Organization'));

    expect(await screen.findByRole('menuitemradio', {name: /Org 1/})).toHaveAttribute(
      'href',
      '/organizations/org-1/issues/'
    );
    expect(await screen.findByRole('menuitemradio', {name: /Org 2/})).toHaveAttribute(
      'href',
      '/organizations/org-2/issues/'
    );
  });

  it('Shows inactive orgs in their own section', async () => {
    OrganizationsStore.addOrReplace(
      OrganizationFixture({id: '1', name: 'Org 1', slug: 'org-1'})
    );
    OrganizationsStore.addOrReplace(
      OrganizationFixture({
        id: '2',
        name: 'Deleting org',
        slug: 'org-2',
        status: {id: 'pending_deletion', name: 'pending deletion'},
      })
    );
    OrganizationsStore.addOrReplace(
      OrganizationFixture({
        id: '3',
        name: 'Disabled org',
        slug: 'org-3',
        status: {id: 'disabled', name: 'disabled'},
      })
    );

    render(<OrganizationDropdown />, {organization});

    await userEvent.click(screen.getByRole('button', {name: 'Toggle organization menu'}));
    await userEvent.hover(screen.getByText('Switch Organization'));

    const separator = await screen.findByRole('separator');
    expect(separator).toBeInTheDocument();

    const inactiveGroup = screen
      .getByRole('menuitemradio', {name: /Disabled org/})
      .closest('[role="group"]');
    if (!(inactiveGroup instanceof HTMLElement)) {
      throw new Error('Expected group of inactive organizations');
    }

    expect(
      within(inactiveGroup).getByRole('menuitemradio', {name: /Deleting org/})
    ).toBeInTheDocument();
    expect(inactiveGroup).not.toContainElement(
      screen.getByRole('menuitemradio', {name: /Org 1/})
    );
  });

  it('clicking project sets referrer in session storage', async () => {
    render(<OrganizationDropdown />, {organization});
    await userEvent.click(screen.getByRole('button', {name: 'Toggle organization menu'}));
    // We use onAction to navigationigate, no href is set:
    expect(screen.getByRole('menuitemradio', {name: 'Projects'})).not.toHaveAttribute(
      'href'
    );
    // onClick should take precedence setting session storage value and navigationigating:
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Projects'}));
    expect(readStorageValue(CUSTOM_REFERRER_KEY, null)).toBe('org-dropdown');
  });
});
