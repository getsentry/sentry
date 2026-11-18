import {ProjectFixture} from 'sentry-fixture/project';

import {sortProjects, sortProjectsByBookmarkAndMembership} from './sortProjects';

describe('sortProjects', () => {
  it('sorts by bookmark and project slug', () => {
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

  it('sorts numbers in slugs by numeric value', () => {
    const projects = ['web10', 'web2', 'web1'].map(slug =>
      ProjectFixture({isBookmarked: false, slug})
    );

    expect(sortProjects(projects).map(p => p.slug)).toEqual(['web1', 'web2', 'web10']);
  });
});

describe('sortProjectsByBookmarkAndMembership', () => {
  it('sorts by bookmark, then membership, then project slug', () => {
    const projects = [
      ProjectFixture({id: '1', slug: 'm', isBookmarked: false, isMember: false}),
      ProjectFixture({id: '2', slug: 'z', isBookmarked: false, isMember: true}),
      ProjectFixture({id: '3', slug: 'a', isBookmarked: false, isMember: true}),
      ProjectFixture({id: '4', slug: 'y', isBookmarked: true, isMember: false}),
      ProjectFixture({id: '5', slug: 'b', isBookmarked: true, isMember: true}),
    ];

    expect(sortProjectsByBookmarkAndMembership(projects).map(p => p.slug)).toEqual([
      'b',
      'y',
      'a',
      'z',
      'm',
    ]);
  });

  it('sorts by the given bookmarked IDs instead of isBookmarked', () => {
    const projects = [
      ProjectFixture({id: '1', slug: 'a', isBookmarked: true, isMember: true}),
      ProjectFixture({id: '2', slug: 'b', isBookmarked: false, isMember: true}),
    ];

    expect(
      sortProjectsByBookmarkAndMembership(projects, new Set(['2'])).map(p => p.slug)
    ).toEqual(['b', 'a']);
  });

  it('sorts numbers in slugs by numeric value', () => {
    const projects = ['web10', 'web2', 'web1'].map((slug, i) =>
      ProjectFixture({id: String(i), slug, isBookmarked: false, isMember: true})
    );

    expect(sortProjectsByBookmarkAndMembership(projects).map(p => p.slug)).toEqual([
      'web1',
      'web2',
      'web10',
    ]);
  });
});
