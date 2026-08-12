import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';
import {OrganizationsStore} from 'sentry/stores/organizationsStore';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {OrganizationDropdown} from 'sentry/views/navigation/primary/organizationDropdown';

describe('OrganizationDropdown', () => {
  const organization = OrganizationFixture({
    access: ['org:read', 'member:read', 'team:read'],
  });

  beforeEach(() => {
    ConfigStore.set('user', UserFixture());
    ProjectsStore.reset();
  });

  it('displays org info and links', async () => {
    render(<OrganizationDropdown />, {organization});

    await userEvent.click(screen.getByRole('button', {name: 'Toggle organization menu'}));

    expect(screen.getByText('Organization Name')).toBeInTheDocument();
    expect(screen.getByText('0 Projects')).toBeInTheDocument();

    expect(screen.getByRole('menuitemradio', {name: 'Settings'})).toHaveAttribute(
      'href',
      `/settings/${organization.slug}/`
    );
    expect(
      screen.getByRole('menuitemradio', {name: 'Switch Organization'})
    ).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', {name: 'All Projects'})).toBeInTheDocument();
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

  it('shows inactive orgs alongside active ones', async () => {
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

    render(<OrganizationDropdown />, {organization});

    await userEvent.click(screen.getByRole('button', {name: 'Toggle organization menu'}));
    await userEvent.hover(screen.getByText('Switch Organization'));

    expect(await screen.findByRole('menuitemradio', {name: /Org 1/})).toBeInTheDocument();
    expect(
      await screen.findByRole('menuitemradio', {name: /Deleting org/})
    ).toBeInTheDocument();
  });

  it('lists every project when there are only a few, starred or not', async () => {
    ProjectsStore.loadInitialData([
      ProjectFixture({id: '1', slug: 'plain-project', isBookmarked: false}),
      ProjectFixture({id: '2', slug: 'other-project', isBookmarked: false}),
    ]);

    render(<OrganizationDropdown />, {organization});
    await userEvent.click(screen.getByRole('button', {name: 'Toggle organization menu'}));

    // Nothing is starred, but the section is still useful
    expect(screen.getByRole('menuitemradio', {name: 'plain-project'})).toHaveAttribute(
      'href',
      `/settings/${organization.slug}/projects/plain-project/`
    );
    expect(
      screen.getByRole('menuitemradio', {name: 'other-project'})
    ).toBeInTheDocument();
    expect(screen.getByText('Project Settings')).toBeInTheDocument();

    // Every project is already listed, so this links out rather than opening a
    // submenu that would repeat them
    expect(screen.getByRole('menuitemradio', {name: /All Projects/})).toHaveAttribute(
      'href',
      `/settings/${organization.slug}/projects/`
    );
  });

  it('narrows to starred projects once there are many', async () => {
    ProjectsStore.loadInitialData([
      ProjectFixture({id: '1', slug: 'starred-project', isBookmarked: true}),
      ...Array.from({length: 8}, (_, i) =>
        ProjectFixture({id: `${i + 2}`, slug: `plain-project-${i + 1}`})
      ),
    ]);

    render(<OrganizationDropdown />, {organization});
    await userEvent.click(screen.getByRole('button', {name: 'Toggle organization menu'}));

    expect(screen.getByText('Starred Projects')).toBeInTheDocument();
    expect(
      screen.getByRole('menuitemradio', {name: 'starred-project'})
    ).toBeInTheDocument();
    // Non-starred projects are only reachable through the submenu
    expect(
      screen.queryByRole('menuitemradio', {name: 'plain-project-1'})
    ).not.toBeInTheDocument();

    await userEvent.hover(screen.getByText('All Projects'));

    expect(
      await screen.findByRole('menuitemradio', {name: /plain-project-1/})
    ).toBeInTheDocument();
  });

  it('shows the project count on the All Projects row', async () => {
    ProjectsStore.loadInitialData(
      Array.from({length: 12}, (_, i) =>
        ProjectFixture({id: `${i + 1}`, slug: `project-${i + 1}`})
      )
    );

    render(<OrganizationDropdown />, {organization});
    await userEvent.click(screen.getByRole('button', {name: 'Toggle organization menu'}));

    const row = screen.getByRole('menuitemradio', {name: /All Projects/});
    expect(within(row).getByText('12')).toBeInTheDocument();
  });

  it('caps the height of the menu and its submenus', async () => {
    ProjectsStore.loadInitialData(
      Array.from({length: 12}, (_, i) =>
        ProjectFixture({id: `${i + 1}`, slug: `project-${i + 1}`})
      )
    );

    render(<OrganizationDropdown />, {organization});
    await userEvent.click(screen.getByRole('button', {name: 'Toggle organization menu'}));

    const menus = screen.getAllByRole('menu');
    expect(menus[0]?.closest('[data-overlay]')).toHaveStyle({maxHeight: '600px'});

    // Submenus inherit the cap, so a long project list scrolls instead of
    // running off the screen
    await userEvent.hover(screen.getByText('All Projects'));

    const submenu = (await screen.findAllByRole('menu'))[1];
    expect(submenu?.closest('[data-overlay]')).toHaveStyle({maxHeight: '600px'});
  });

  it('can star a project from the All Projects submenu', async () => {
    ProjectsStore.loadInitialData(
      Array.from({length: 12}, (_, i) =>
        ProjectFixture({id: `${i + 1}`, slug: `project-${i + 1}`})
      )
    );
    const starRequest = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/project-1/`,
      method: 'PUT',
      body: ProjectFixture({id: '1', slug: 'project-1', isBookmarked: true}),
    });

    render(<OrganizationDropdown />, {organization});
    await userEvent.click(screen.getByRole('button', {name: 'Toggle organization menu'}));
    await userEvent.hover(screen.getByText('All Projects'));

    const row = await screen.findByRole('menuitemradio', {name: 'project-1'});
    await userEvent.click(within(row).getByRole('button', {name: 'Bookmark'}));

    expect(starRequest).toHaveBeenCalledWith(
      `/projects/${organization.slug}/project-1/`,
      expect.objectContaining({data: {isBookmarked: true}})
    );
  });

  it('filters projects in the All Projects submenu', async () => {
    ProjectsStore.loadInitialData(
      Array.from({length: 12}, (_, i) =>
        ProjectFixture({id: `${i + 1}`, slug: `project-${i + 1}`})
      )
    );

    render(<OrganizationDropdown />, {organization});
    await userEvent.click(screen.getByRole('button', {name: 'Toggle organization menu'}));
    await userEvent.hover(screen.getByText('All Projects'));

    const search = await screen.findByPlaceholderText('Search projects');
    await userEvent.type(search, 'project-3');

    expect(
      await screen.findByRole('menuitemradio', {name: /project-3/})
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('menuitemradio', {name: /project-1$/})
    ).not.toBeInTheDocument();
  });

  it('hides current-org links and project settings when asked', async () => {
    ProjectsStore.loadInitialData([
      ProjectFixture({id: '1', slug: 'starred-project', isBookmarked: true}),
    ]);

    render(<OrganizationDropdown hideCurrentOrganizationLinks />, {organization});
    await userEvent.click(screen.getByRole('button', {name: 'Toggle organization menu'}));

    expect(
      screen.queryByRole('menuitemradio', {name: 'Settings'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('menuitemradio', {name: 'All Projects'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('menuitemradio', {name: 'starred-project'})
    ).not.toBeInTheDocument();
  });

  it('shows an empty message when no project matches', async () => {
    ProjectsStore.loadInitialData(
      Array.from({length: 12}, (_, i) =>
        ProjectFixture({id: `${i + 1}`, slug: `project-${i + 1}`})
      )
    );

    render(<OrganizationDropdown />, {organization});
    await userEvent.click(screen.getByRole('button', {name: 'Toggle organization menu'}));
    await userEvent.hover(screen.getByText('All Projects'));

    const search = await screen.findByPlaceholderText('Search projects');
    await userEvent.type(search, 'nothing-matches-this');

    expect(await screen.findByText('No projects found')).toBeInTheDocument();
  });
});
