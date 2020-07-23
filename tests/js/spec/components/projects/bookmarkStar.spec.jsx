import React from 'react';

import {mount} from 'sentry-test/enzyme';

import BookmarkStar from 'app/components/projects/bookmarkStar';

describe('BookmarkStar', function() {
  let wrapper, projectMock;

  beforeEach(function() {
    wrapper = mount(
      <BookmarkStar
        organization={TestStubs.Organization()}
        project={TestStubs.Project()}
      />,
      TestStubs.routerContext()
    );

    projectMock = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      method: 'PUT',
      data: TestStubs.Project({isBookmarked: false, platform: 'javascript'}),
    });
  });

  afterEach(function() {
    MockApiClient.clearMockResponses();
  });

  it('renders', function() {
    expect(wrapper).toSnapshot();
    expect(wrapper).toMatchSnapshot();
  });

  it('can star', async function() {
    const star = wrapper.find('BookmarkStar');

    expect(
      star
        .find('Star')
        .first()
        .prop('isBookmarked')
    ).toBe(false);

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

  it('can unstar', async function() {
    wrapper = mount(
      <BookmarkStar
        organization={TestStubs.Organization()}
        project={TestStubs.Project({
          isBookmarked: true,
        })}
      />,
      TestStubs.routerContext()
    );
    const star = wrapper.find('BookmarkStar');

    expect(
      star
        .find('Star')
        .first()
        .prop('isBookmarked')
    ).toBe(true);

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

  it('takes a manual isBookmarked prop', function() {
    wrapper = mount(
      <BookmarkStar
        organization={TestStubs.Organization()}
        project={TestStubs.Project()}
        isBookmarked
      />,
      TestStubs.routerContext()
    );

    const star = wrapper.find('BookmarkStar');

    expect(
      star
        .find('Star')
        .first()
        .prop('isBookmarked')
    ).toBe(true);

    star.simulate('click');

    expect(
      star
        .find('Star')
        .first()
        .prop('isBookmarked')
    ).toBe(true);
  });
});
