import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import {
  useCanCreateAutomation,
  useCanEditAutomation,
} from 'sentry/views/automations/hooks/useCanEditAutomation';

describe('useCanEditAutomation', () => {
  const organization = OrganizationFixture({
    access: ['org:read', 'alerts:read'],
  });
  const writableProject = ProjectFixture({
    id: '1',
    access: ['project:read', 'alerts:write'],
  });
  const readOnlyProject = ProjectFixture({
    id: '2',
    access: ['project:read', 'alerts:read'],
  });

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    ProjectsStore.loadInitialData([writableProject, readOnlyProject]);
  });

  it('does not request project scope with organization write access', () => {
    const projectScopeRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/workflows/123/project-scope/',
      body: {projectIds: [], includesAllProjects: true},
    });

    const {result} = renderHookWithProviders(() => useCanEditAutomation('123'), {
      organization: OrganizationFixture(),
    });

    expect(result.current).toBe(true);
    expect(projectScopeRequest).not.toHaveBeenCalled();
  });

  it('rejects an all-projects alert with only organization-level alert write access', async () => {
    const alertWriterOrganization = OrganizationFixture({
      access: ['org:read', 'alerts:read', 'alerts:write'],
    });
    const projectScopeRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/workflows/123/project-scope/',
      body: {projectIds: [], includesAllProjects: true},
    });

    const {result} = renderHookWithProviders(() => useCanEditAutomation('123'), {
      organization: alertWriterOrganization,
    });

    await waitFor(() => expect(projectScopeRequest).toHaveBeenCalled());
    expect(result.current).toBe(false);
  });

  it('allows a project-scoped alert with organization-level alert write access', async () => {
    const alertWriterOrganization = OrganizationFixture({
      access: ['org:read', 'alerts:read', 'alerts:write'],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/workflows/123/project-scope/',
      body: {projectIds: [readOnlyProject.id], includesAllProjects: false},
    });

    const {result} = renderHookWithProviders(() => useCanEditAutomation('123'), {
      organization: alertWriterOrganization,
    });

    await waitFor(() => expect(result.current).toBe(true));
  });

  it('does not request project scope without any writable projects', () => {
    ProjectsStore.loadInitialData([readOnlyProject]);
    const projectScopeRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/workflows/123/project-scope/',
      body: {projectIds: [], includesAllProjects: false},
    });

    const {result} = renderHookWithProviders(() => useCanEditAutomation('123'), {
      organization,
    });

    expect(result.current).toBe(false);
    expect(projectScopeRequest).not.toHaveBeenCalled();
  });

  it('allows an alert connected only to writable projects', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/workflows/123/project-scope/',
      body: {projectIds: [writableProject.id], includesAllProjects: false},
    });

    const {result} = renderHookWithProviders(() => useCanEditAutomation('123'), {
      organization,
    });

    await waitFor(() => expect(result.current).toBe(true));
  });

  it('rejects an alert connected to any project without write access', async () => {
    const projectScopeRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/workflows/123/project-scope/',
      body: {
        projectIds: [writableProject.id, readOnlyProject.id],
        includesAllProjects: false,
      },
    });

    const {result} = renderHookWithProviders(() => useCanEditAutomation('123'), {
      organization,
    });

    await waitFor(() => expect(projectScopeRequest).toHaveBeenCalled());
    expect(result.current).toBe(false);
  });

  it.each([
    {projectIds: [], includesAllProjects: false},
    {projectIds: [], includesAllProjects: true},
  ])('rejects an unattached or all-projects alert: %o', async projectScope => {
    const projectScopeRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/workflows/123/project-scope/',
      body: projectScope,
    });

    const {result} = renderHookWithProviders(() => useCanEditAutomation('123'), {
      organization,
    });

    await waitFor(() => expect(projectScopeRequest).toHaveBeenCalled());
    expect(result.current).toBe(false);
  });

  it('allows creating alerts when any project is writable', () => {
    const {result} = renderHookWithProviders(() => useCanCreateAutomation(), {
      organization,
    });

    expect(result.current).toBe(true);
  });
});
