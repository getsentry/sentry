import {ProjectFixture} from 'sentry-fixture/project';

import {ALL_ACCESS_PROJECTS} from 'sentry/components/pageFilters/constants';

import {
  getSelectedProjectsForLLMContext,
  toLLMContextProjectFields,
} from './selectedProjectsForLLMContext';

describe('getSelectedProjectsForLLMContext', () => {
  const projects = [
    ProjectFixture({id: '1', slug: 'frontend'}),
    ProjectFixture({id: '2', slug: 'backend'}),
    ProjectFixture({id: '4509062593708032', slug: 'mcp-server'}),
  ];

  it('returns concrete id+slug pairs and an explicit-scope instruction', () => {
    const result = getSelectedProjectsForLLMContext([1, 2], projects);
    expect(result).toEqual({
      selectionMode: 'explicit',
      isAllProjects: false,
      projectIds: ['1', '2'],
      projectSlugs: ['frontend', 'backend'],
      projects: [
        {id: '1', slug: 'frontend'},
        {id: '2', slug: 'backend'},
      ],
      instruction:
        'Page filter pins these projects — scope queries to them unless the user asks otherwise: frontend (id: 1), backend (id: 2).',
    });
  });

  it('resolves large SaaS project ids via Number(project.id) lookup', () => {
    // PageFilters stores project ids as numbers; project.id remains a string.
    expect(getSelectedProjectsForLLMContext([4509062593708032], projects)).toEqual({
      selectionMode: 'explicit',
      isAllProjects: false,
      projectIds: ['4509062593708032'],
      projectSlugs: ['mcp-server'],
      projects: [{id: '4509062593708032', slug: 'mcp-server'}],
      instruction:
        'Page filter pins these projects — scope queries to them unless the user asks otherwise: mcp-server (id: 4509062593708032).',
    });
  });

  it('treats empty selection as My Projects with a specific agent instruction', () => {
    const result = getSelectedProjectsForLLMContext([], projects);
    expect(result.selectionMode).toBe('my-projects');
    // My Projects is a member subset — not org-wide All Projects.
    expect(result.isAllProjects).toBe(false);
    expect(result.projectIds).toEqual([]);
    expect(result.projectSlugs).toEqual([]);
    expect(result.projects).toEqual([]);
    expect(result.instruction).toContain('My Projects');
    expect(result.instruction).toContain('Empty projectIds/projectSlugs is expected');
    expect(result.instruction).toContain('Do not invent a specific project slug');
  });

  it('treats the all-access sentinel as All Projects with a specific agent instruction', () => {
    const result = getSelectedProjectsForLLMContext([ALL_ACCESS_PROJECTS], projects);
    expect(result.selectionMode).toBe('all-projects');
    expect(result.isAllProjects).toBe(true);
    expect(result.projectIds).toEqual([]);
    expect(result.projectSlugs).toEqual([]);
    expect(result.projects).toEqual([]);
    expect(result.instruction).toContain('All Projects');
    expect(result.instruction).toContain('Empty projectIds/projectSlugs is expected');
    expect(result.instruction).toContain('Do not invent a specific project slug');
  });

  it('skips unknown project ids rather than inventing slugs', () => {
    expect(getSelectedProjectsForLLMContext([1, 999], projects)).toEqual({
      selectionMode: 'explicit',
      isAllProjects: false,
      projectIds: ['1'],
      projectSlugs: ['frontend'],
      projects: [{id: '1', slug: 'frontend'}],
      instruction:
        'Page filter pins these projects — scope queries to them unless the user asks otherwise: frontend (id: 1).',
    });
  });
});

describe('toLLMContextProjectFields', () => {
  it('flattens the shared shape for page-level useLLMContext spreads', () => {
    const selected = getSelectedProjectsForLLMContext(
      [],
      [ProjectFixture({id: '1', slug: 'frontend'})]
    );
    expect(toLLMContextProjectFields(selected)).toEqual({
      projectIds: [],
      projectSlugs: [],
      isAllProjects: false,
      projectSelectionMode: 'my-projects',
      projectSelectionInstruction: selected.instruction,
    });
  });
});
