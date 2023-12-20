import {Organization} from 'sentry-fixture/organization';
import {Project as ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import BookmarkStar from 'sentry/components/projects/bookmarkStar';
import ProjectsStore from 'sentry/stores/projectsStore';

describe('BookmarkStar', function () {
  const project = ProjectFixture();

  beforeEach(function () {
    ProjectsStore.loadInitialData([project]);
  });

  afterEach(function () {
    ProjectsStore.reset();
    MockApiClient.clearMockResponses();
  });

  it('renders', function () {
    render(<BookmarkStar organization={Organization()} project={project} />);
  });

  it('can star', async function () {
    render(<BookmarkStar organization={Organization()} project={project} />);

    const projectMock = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      method: 'PUT',
      body: ProjectFixture({isBookmarked: true, platform: 'javascript'}),
    });

    expect(screen.getByRole('button', {pressed: false})).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button'));

    // Visually optimistically updated
    expect(screen.getByRole('button', {pressed: true})).toBeInTheDocument();

    expect(projectMock).toHaveBeenCalledWith(
      '/projects/org-slug/project-slug/',
      expect.objectContaining({data: {isBookmarked: true}})
    );

    expect(ProjectsStore.getBySlug(project.slug)?.isBookmarked).toBe(true);
  });

  it('can unstar', async function () {
    render(
      <BookmarkStar
        organization={Organization()}
        project={ProjectFixture({isBookmarked: true})}
      />
    );

    const projectMock = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      method: 'PUT',
      body: ProjectFixture({isBookmarked: false, platform: 'javascript'}),
    });

    expect(screen.getByRole('button', {pressed: true})).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button'));

    // Visually optimistically updated
    expect(screen.getByRole('button', {pressed: false})).toBeInTheDocument();

    expect(projectMock).toHaveBeenCalledWith(
      '/projects/org-slug/project-slug/',
      expect.objectContaining({data: {isBookmarked: false}})
    );

    // Not yet updated in the project store
    expect(ProjectsStore.getBySlug(project.slug)?.isBookmarked).toBe(false);

    // Project store is updated
    await waitFor(() => {
      const updatedProject = ProjectsStore.getBySlug(project.slug);
      expect(updatedProject?.isBookmarked).toBe(false);
    });
  });
});
