import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ProjectList} from 'sentry/components/projectList';

describe('ProjectList', () => {
  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [
        {id: '1', slug: 'project1'},
        {id: '2', slug: 'project2'},
        {id: '3', slug: 'project3'},
      ],
    });
  });

  it('renders all projects when there is no overflow', async () => {
    render(
      <ProjectList projectSlugs={['project1', 'project2']} maxVisibleProjects={2} />
    );

    expect(await screen.findAllByRole('img')).toHaveLength(2);
  });

  it('renders the collapsed projects when there is overflow', async () => {
    render(
      <ProjectList
        projectSlugs={['project1', 'project2', 'project3']}
        maxVisibleProjects={2}
      />
    );

    // Should show project 1 and the collapsed badge
    expect(await screen.findAllByRole('img')).toHaveLength(1);
    expect(screen.getByText('+2')).toBeInTheDocument();

    // Hovering should show the collapsed projects
    await userEvent.hover(screen.getByText('+2'));
    expect(await screen.findByText('project2')).toBeInTheDocument();
    expect(await screen.findByText('project3')).toBeInTheDocument();
  });
});
