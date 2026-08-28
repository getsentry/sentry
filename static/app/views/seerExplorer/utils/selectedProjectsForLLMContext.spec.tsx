import {ProjectFixture} from 'sentry-fixture/project';

import {ALL_ACCESS_PROJECTS} from 'sentry/components/pageFilters/constants';

import {getSelectedProjectsForLLMContext} from './selectedProjectsForLLMContext';

describe('getSelectedProjectsForLLMContext', () => {
  const projects = [
    ProjectFixture({id: '1', slug: 'frontend'}),
    ProjectFixture({id: '2', slug: 'backend'}),
    ProjectFixture({id: '4509062593708032', slug: 'mcp-server'}),
  ];

  it('returns concrete id+slug pairs for an explicit selection', () => {
    expect(getSelectedProjectsForLLMContext([1, 2], projects)).toEqual({
      isAllProjects: false,
      projectIds: ['1', '2'],
      projectSlugs: ['frontend', 'backend'],
      projects: [
        {id: '1', slug: 'frontend'},
        {id: '2', slug: 'backend'},
      ],
    });
  });

  it('resolves large SaaS project ids via Number(project.id) lookup', () => {
    // PageFilters stores project ids as numbers; project.id remains a string.
    expect(getSelectedProjectsForLLMContext([4509062593708032], projects)).toEqual({
      isAllProjects: false,
      projectIds: ['4509062593708032'],
      projectSlugs: ['mcp-server'],
      projects: [{id: '4509062593708032', slug: 'mcp-server'}],
    });
  });

  it('treats empty selection as my/all projects without expanding membership', () => {
    expect(getSelectedProjectsForLLMContext([], projects)).toEqual({
      isAllProjects: true,
      projectIds: [],
      projectSlugs: [],
      projects: [],
    });
  });

  it('treats the all-access sentinel as all projects without expanding membership', () => {
    expect(getSelectedProjectsForLLMContext([ALL_ACCESS_PROJECTS], projects)).toEqual({
      isAllProjects: true,
      projectIds: [],
      projectSlugs: [],
      projects: [],
    });
  });

  it('skips unknown project ids rather than inventing slugs', () => {
    expect(getSelectedProjectsForLLMContext([1, 999], projects)).toEqual({
      isAllProjects: false,
      projectIds: ['1'],
      projectSlugs: ['frontend'],
      projects: [{id: '1', slug: 'frontend'}],
    });
  });
});
