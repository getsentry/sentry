import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import BookmarkStar from 'sentry/components/projects/bookmarkStar';

describe('BookmarkStar', function () {
  let projectMock: jest.Mock;

  beforeEach(function () {
    projectMock = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      method: 'PUT',
      body: TestStubs.Project({isBookmarked: false, platform: 'javascript'}),
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('renders', function () {
    const {container} = render(
      <BookmarkStar
        organization={TestStubs.Organization()}
        project={TestStubs.Project()}
      />
    );

    expect(container).toSnapshot();
  });

  it('can star', async function () {
    render(
      <BookmarkStar
        organization={TestStubs.Organization()}
        project={TestStubs.Project()}
      />
    );

    expect(screen.getByRole('button', {pressed: false})).toBeInTheDocument();
    userEvent.click(screen.getByRole('button'));

    expect(projectMock).toHaveBeenCalledWith(
      '/projects/org-slug/project-slug/',
      expect.objectContaining({data: {isBookmarked: true}})
    );
  });

  it('can unstar', async function () {
    render(
      <BookmarkStar
        organization={TestStubs.Organization()}
        project={TestStubs.Project({
          isBookmarked: true,
        })}
      />
    );

    expect(screen.getByRole('button', {pressed: true})).toBeInTheDocument();
    userEvent.click(screen.getByRole('button'));

    expect(projectMock).toHaveBeenCalledWith(
      '/projects/org-slug/project-slug/',
      expect.objectContaining({data: {isBookmarked: false}})
    );
  });

  it('takes a manual isBookmarked prop', async function () {
    render(
      <BookmarkStar
        organization={TestStubs.Organization()}
        project={TestStubs.Project()}
        isBookmarked
      />
    );

    expect(screen.getByRole('button', {pressed: true})).toBeInTheDocument();
    userEvent.click(screen.getByRole('button'));

    // State if isBookmarked is maintained via the prop
    expect(await screen.findByRole('button', {pressed: true})).toBeInTheDocument();
  });
});
