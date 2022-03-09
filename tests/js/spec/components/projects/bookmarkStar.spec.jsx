import {mountWithTheme} from 'sentry-test/enzyme';

import BookmarkStar from 'sentry/components/projects/bookmarkStar';

describe('BookmarkStar', function () {
  let wrapper, projectMock;

  beforeEach(function () {
    wrapper = mountWithTheme(
      <BookmarkStar
        organization={TestStubs.Organization()}
        project={TestStubs.Project()}
      />
    );

    projectMock = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      method: 'PUT',
      data: TestStubs.Project({isBookmarked: false, platform: 'javascript'}),
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('renders', function () {
    expect(wrapper).toSnapshot();
  });

  it('can star', async function () {
    const star = wrapper.find('BookmarkStar');

    expect(star.find('Star').first().prop('isBookmarked')).toBe(false);

    star.simulate('click');

    expect(projectMock).toHaveBeenCalledWith(
      '/projects/org-slug/project-slug/',
      expect.objectContaining({
        data: {
          isBookmarked: true,
        },
      })
    );
  });

  it('can unstar', async function () {
    wrapper = mountWithTheme(
      <BookmarkStar
        organization={TestStubs.Organization()}
        project={TestStubs.Project({
          isBookmarked: true,
        })}
      />
    );
    const star = wrapper.find('BookmarkStar');

    expect(star.find('Star').first().prop('isBookmarked')).toBe(true);

    star.simulate('click');

    expect(projectMock).toHaveBeenCalledWith(
      '/projects/org-slug/project-slug/',
      expect.objectContaining({
        data: {
          isBookmarked: false,
        },
      })
    );
  });

  it('takes a manual isBookmarked prop', function () {
    wrapper = mountWithTheme(
      <BookmarkStar
        organization={TestStubs.Organization()}
        project={TestStubs.Project()}
        isBookmarked
      />
    );

    const star = wrapper.find('BookmarkStar');

    expect(star.find('Star').first().prop('isBookmarked')).toBe(true);

    star.simulate('click');

    expect(star.find('Star').first().prop('isBookmarked')).toBe(true);
  });
});
