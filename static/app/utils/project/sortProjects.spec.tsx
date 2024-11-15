import {ProjectFixture} from 'sentry-fixture/project';

import {sortProjects} from 'sentry/utils/project/sortProjects';

describe('sortProjects', function () {
  it('sorts by bookmark and project slug', function () {
    const projects = [
      ProjectFixture({isBookmarked: true, slug: 'm'}),
      ProjectFixture({isBookmarked: false, slug: 'm'}),
      ProjectFixture({isBookmarked: false, slug: 'a'}),
      ProjectFixture({isBookmarked: true, slug: 'a'}),
      ProjectFixture({isBookmarked: true, slug: 'z'}),
      ProjectFixture({isBookmarked: false, slug: 'z'}),
    ];

    const expected = [
      expect.objectContaining({isBookmarked: true, slug: 'a'}),
      expect.objectContaining({isBookmarked: true, slug: 'm'}),
      expect.objectContaining({isBookmarked: true, slug: 'z'}),
      expect.objectContaining({isBookmarked: false, slug: 'a'}),
      expect.objectContaining({isBookmarked: false, slug: 'm'}),
      expect.objectContaining({isBookmarked: false, slug: 'z'}),
    ];

    const sortedProjects = sortProjects(projects);

    expect(sortedProjects).toEqual(expected);
  });
});
