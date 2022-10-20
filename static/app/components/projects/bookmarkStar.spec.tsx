import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import BookmarkStar from 'sentry/components/projects/bookmarkStar';
import ProjectsStore from 'sentry/stores/projectsStore';

describe('BookmarkStar', function () {
  const project = TestStubs.Project();

  beforeEach(function () {
    ProjectsStore.loadInitialData([project]);
  });

  afterEach(function () {
    ProjectsStore.reset();
    MockApiClient.clearMockResponses();
  });

  it('renders', function () {
    const {container} = render(
      <BookmarkStar organization={TestStubs.Organization()} project={project} />
    );

    expect(container).toSnapshot();
  });

  it('can star', async function () {
    render(<BookmarkStar organization={TestStubs.Organization()} project={project} />);

    const projectMock = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      method: 'PUT',
      body: TestStubs.Project({isBookmarked: true, platform: 'javascript'}),
    });

    expect(screen.getByRole('button', {pressed: false})).toBeInTheDocument();
    userEvent.click(screen.getByRole('button'));

    // Visually optimistically updated
    expect(screen.getByRole('button', {pressed: true})).toBeInTheDocument();

    expect(projectMock).toHaveBeenCalledWith(
      '/projects/org-slug/project-slug/',
      expect.objectContaining({data: {isBookmarked: true}})
    );

    // Not yet updated in the project store
    expect(ProjectsStore.getBySlug(project.slug)?.isBookmarked).toBe(false);

    // Project store is updated
    await waitFor(() => {
      const updatedProject = ProjectsStore.getBySlug(project.slug);
      expect(updatedProject?.isBookmarked).toBe(true);
    });
  });

  it('can unstar', async function () {
    render(
      <BookmarkStar
        organization={TestStubs.Organization()}
        project={TestStubs.Project({isBookmarked: true})}
      />
    );

    const projectMock = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      method: 'PUT',
      body: TestStubs.Project({isBookmarked: false, platform: 'javascript'}),
    });

    expect(screen.getByRole('button', {pressed: true})).toBeInTheDocument();
    userEvent.click(screen.getByRole('button'));

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
