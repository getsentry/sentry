import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {CUSTOM_REFERRER_KEY} from 'sentry/constants';
import {ConfigStore} from 'sentry/stores/configStore';
import {OrganizationsStore} from 'sentry/stores/organizationsStore';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {readStorageValue} from 'sentry/utils/useSessionStorage';
import {OrganizationDropdown} from 'sentry/views/navigation/primary/organizationDropdown';

describe('OrganizationDropdown', () => {
  const organization = OrganizationFixture({
    access: ['org:read', 'member:read', 'team:read'],
  });

  beforeEach(() => {
    ConfigStore.set('user', UserFixture());
  });

  afterEach(() => {
    ProjectsStore.reset();
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

  it('filters projects in the settings v3 All Projects submenu', async () => {
    ProjectsStore.loadInitialData([
      ProjectFixture({id: '1', slug: 'javascript', isMember: true, isBookmarked: true}),
      ProjectFixture({id: '2', slug: 'python', isMember: true}),
    ]);
    const {router} = render(<OrganizationDropdown />, {
      organization: OrganizationFixture({...organization, features: ['settings-v3']}),
    });

    await userEvent.click(screen.getByRole('button', {name: 'Toggle organization menu'}));
    expect(screen.getByRole('menuitemradio', {name: 'Settings'})).toHaveAttribute(
      'href',
      `/settings/${organization.slug}/`
    );
    await userEvent.hover(screen.getByRole('menuitemradio', {name: 'View All Projects'}));

    const search = screen.getByRole('textbox', {name: 'Search'});
    expect(search).toHaveFocus();
    expect(within(search.parentElement!).queryByRole('img')).not.toBeInTheDocument();
    await userEvent.type(search, 'python');
    expect(screen.getByRole('menuitemradio', {name: 'python'})).toBeInTheDocument();
    await userEvent.keyboard('{ArrowLeft}');
    expect(search).toHaveFocus();
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'python'}));
    expect(router.location.pathname).toBe(
      `/settings/${organization.slug}/projects/python/`
    );
  });

  it('bookmarks a project without navigating away from the settings v3 menu', async () => {
    const project = ProjectFixture({
      id: '1',
      slug: 'javascript',
      isMember: true,
      isBookmarked: true,
    });
    ProjectsStore.loadInitialData([project]);
    const projectMock = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      method: 'PUT',
      body: {...project, isBookmarked: false},
    });
    const {router} = render(<OrganizationDropdown />, {
      organization: OrganizationFixture({...organization, features: ['settings-v3']}),
    });

    await userEvent.click(screen.getByRole('button', {name: 'Toggle organization menu'}));
    const row = screen.getByRole('menuitemradio', {name: 'javascript'});
    await userEvent.click(within(row).getByRole('button', {name: 'Remove Bookmark'}));

    expect(projectMock).toHaveBeenCalled();
    expect(router.location.pathname).not.toBe(
      `/settings/${organization.slug}/projects/${project.slug}/`
    );
    expect(
      screen.getByRole('menuitemradio', {name: 'View All Projects'})
    ).toBeInTheDocument();
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
