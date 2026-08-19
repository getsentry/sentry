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
    access: ['org:read', 'member:read', 'team:read', 'project:write'],
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
    expect(screen.getByRole('menuitemradio', {name: /All Projects/})).toBeInTheDocument();
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

  it('lists every project when there are only a few', async () => {
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
    expect(screen.getByText('Projects')).toBeInTheDocument();
  });

  it('can star a project from the projects section', async () => {
    ProjectsStore.loadInitialData([ProjectFixture({id: '1', slug: 'plain-project'})]);
    const starRequest = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/plain-project/`,
      method: 'PUT',
      body: ProjectFixture({id: '1', slug: 'plain-project', isBookmarked: true}),
    });

    render(<OrganizationDropdown />, {organization});
    await userEvent.click(screen.getByRole('button', {name: 'Toggle organization menu'}));

    const row = screen.getByRole('menuitemradio', {name: 'plain-project'});
    await userEvent.click(within(row).getByRole('button', {name: 'Bookmark'}));

    expect(starRequest).toHaveBeenCalledWith(
      `/projects/${organization.slug}/plain-project/`,
      expect.objectContaining({data: {isBookmarked: true}})
    );
  });

  it('pins Create Project to the All Projects submenu footer', async () => {
    // Enough projects to scroll, where an in-list action would be out of reach
    ProjectsStore.loadInitialData(
      Array.from({length: 40}, (_, i) =>
        ProjectFixture({id: `${i + 1}`, slug: `project-${i + 1}`})
      )
    );

    render(<OrganizationDropdown />, {organization});
    await userEvent.click(screen.getByRole('button', {name: 'Toggle organization menu'}));

    expect(
      screen.queryByRole('button', {name: 'Create Project'})
    ).not.toBeInTheDocument();

    await userEvent.hover(screen.getByText('All Projects'));

    // Rendered as a LinkButton, so the anchor carries role="button"
    // Path depends on the insights rollout flag, so match the meaningful suffix
    const createProject = await screen.findByRole('button', {name: 'Create Project'});
    expect(createProject).toHaveAttribute(
      'href',
      expect.stringMatching(/\/projects\/new\/$/)
    );

    // Lives outside the scrolling list, so it stays put while the list scrolls
    const submenu = (await screen.findAllByRole('menu'))[1]!;
    expect(submenu).not.toContainElement(createProject);
  });

  it('hides Create Project without project:write access', async () => {
    ProjectsStore.loadInitialData([ProjectFixture({id: '1', slug: 'plain-project'})]);

    render(<OrganizationDropdown />, {
      organization: OrganizationFixture({access: ['org:read']}),
    });
    await userEvent.click(screen.getByRole('button', {name: 'Toggle organization menu'}));
    await userEvent.hover(screen.getByText('All Projects'));

    // The submenu is open (it lists the project), but offers no create action
    const submenu = (await screen.findAllByRole('menu'))[1]!;
    expect(
      within(submenu).getByRole('menuitemradio', {name: 'plain-project'})
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Create Project'})
    ).not.toBeInTheDocument();
  });

  it('shows member projects with starred ones first once there are many', async () => {
    ProjectsStore.loadInitialData([
      ProjectFixture({id: '1', slug: 'zeta-member'}),
      ProjectFixture({id: '2', slug: 'alpha-member'}),
      ProjectFixture({id: '3', slug: 'starred-member', isBookmarked: true}),
      ...Array.from({length: 8}, (_, i) =>
        ProjectFixture({id: `${i + 4}`, slug: `other-member-${i + 1}`})
      ),
    ]);

    render(<OrganizationDropdown />, {organization});
    await userEvent.click(screen.getByRole('button', {name: 'Toggle organization menu'}));

    const listed = screen
      .getAllByRole('menuitemradio')
      .map(row => row.getAttribute('data-test-id'))
      .filter(id => id?.startsWith('project-'));

    // Capped at 5, starred elevated to the top, the rest alphabetical
    expect(listed).toHaveLength(5);
    expect(listed[0]).toBe('project-3');
    expect(listed[1]).toBe('project-2');

    // The remainder is reachable through the submenu
    expect(screen.getByRole('menuitemradio', {name: /All Projects/})).toBeInTheDocument();
  });

  it('falls back to all projects when the user is a member of none', async () => {
    ProjectsStore.loadInitialData(
      Array.from({length: 12}, (_, i) =>
        ProjectFixture({
          id: `${i + 1}`,
          slug: `project-${String(i + 1).padStart(2, '0')}`,
          isMember: false,
        })
      )
    );

    render(<OrganizationDropdown />, {organization});
    await userEvent.click(screen.getByRole('button', {name: 'Toggle organization menu'}));

    // Alphabetical, capped at 5
    expect(screen.getByRole('menuitemradio', {name: 'project-01'})).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', {name: 'project-05'})).toBeInTheDocument();
    expect(
      screen.queryByRole('menuitemradio', {name: 'project-06'})
    ).not.toBeInTheDocument();
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

    // Scope to the submenu: only its rows carry the star toggle
    const submenu = (await screen.findAllByRole('menu'))[1]!;
    const row = within(submenu).getByRole('menuitemradio', {name: 'project-1'});
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

    // Scope to the submenu: the inline list above holds the same projects
    const submenu = (await screen.findAllByRole('menu'))[1]!;
    expect(
      await within(submenu).findByRole('menuitemradio', {name: 'project-3'})
    ).toBeInTheDocument();
    expect(
      within(submenu).queryByRole('menuitemradio', {name: 'project-1'})
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
    expect(screen.queryByText('Project Settings')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('menuitemradio', {name: 'Create Project'})
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
