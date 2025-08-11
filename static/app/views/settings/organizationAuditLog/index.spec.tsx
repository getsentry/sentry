import {AuditLogsFixture} from 'sentry-fixture/auditLogs';
import {AuditLogsApiEventNamesFixture} from 'sentry-fixture/auditLogsApiEventNames';
import {UserFixture} from 'sentry-fixture/user';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import ProjectsStore from 'sentry/stores/projectsStore';
import OrganizationAuditLog from 'sentry/views/settings/organizationAuditLog';

describe('OrganizationAuditLog', function () {
  it('renders', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/audit-logs/`,
      method: 'GET',
      body: {
        rows: AuditLogsFixture(),
        options: AuditLogsApiEventNamesFixture(),
      },
    });

    const {router} = initializeOrg({
      projects: [],
      router: {
        params: {orgId: 'org-slug'},
      },
    });

    render(<OrganizationAuditLog location={router.location} />);

    expect(await screen.findByText('project.edit')).toBeInTheDocument();
    expect(screen.getByText('org.edit')).toBeInTheDocument();
    expect(screen.getAllByText('127.0.0.1')).toHaveLength(2);
    expect(
      screen.getByText(textWithMarkupMatcher('edited project ludic-science'))
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'edited the organization setting(s): accountRateLimit from 1000 to 0'
      )
    ).toBeInTheDocument();
  });

  it('Displays pretty dynamic sampling logs', async function () {
    const {router, project, projects, organization} = initializeOrg({
      router: {
        params: {orgId: 'org-slug'},
      },
    });

    ProjectsStore.loadInitialData(projects);

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/audit-logs/`,
      method: 'GET',
      body: {
        rows: [
          {
            actor: UserFixture(),
            event: 'sampling_priority.enabled',
            ipAddress: '127.0.0.1',
            id: '14',
            note: 'enabled dynamic sampling priority "boostLatestRelease"',
            targetObject: 4504363022811136,
            targetUser: null,
            data: {
              id: project.id,
              name: 'boostLatestRelease',
              public: false,
              slug: project.slug,
              status: 0,
            },
          },
          {
            actor: UserFixture(),
            event: 'sampling_priority.disabled',
            ipAddress: '127.0.0.1',
            id: '15',
            note: 'disabled dynamic sampling priority "boostLatestRelease"',
            targetObject: 4504363022811136,
            targetUser: null,
            data: {
              id: project.id,
              name: 'boostLatestRelease',
              public: false,
              slug: project.slug,
              status: 0,
            },
          },
        ],
        options: AuditLogsApiEventNamesFixture(),
      },
    });

    render(<OrganizationAuditLog location={router.location} />);

    // Enabled dynamic sampling priority
    expect(await screen.findByText('sampling_priority.enabled')).toBeInTheDocument();
    expect(
      screen.getByText(
        textWithMarkupMatcher(
          `Enabled retention priority "Prioritize new releases" in project ${project.slug}`
        )
      )
    ).toBeInTheDocument();

    // Disabled dynamic sampling priority
    expect(screen.getByText('sampling_priority.disabled')).toBeInTheDocument();
    expect(
      screen.getByText(
        textWithMarkupMatcher(
          `Disabled retention priority "Prioritize new releases" in project ${project.slug}`
        )
      )
    ).toBeInTheDocument();

    // Extra checks for the links to the project's settings
    for (const link of screen.getAllByRole('link', {name: project.slug})) {
      expect(link).toHaveAttribute(
        'href',
        `/settings/${organization.slug}/projects/${project.slug}/performance/`
      );
    }
  });

  it('Handles absolute date range', async function () {
    const absoluteDateMockResponse = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/audit-logs/`,
      method: 'GET',
      body: {
        rows: AuditLogsFixture(),
        options: AuditLogsApiEventNamesFixture(),
      },
    });

    const {router} = initializeOrg({
      projects: [],
      router: {
        params: {orgId: 'org-slug'},
        location: {
          query: {
            start: '2018-02-01T00:00:00.000Z',
            end: '2018-02-28T23:59:59.999Z',
          },
        },
      },
    });

    render(<OrganizationAuditLog location={router.location} />);

    await waitFor(() => {
      expect(absoluteDateMockResponse).toHaveBeenCalledWith(
        '/organizations/org-slug/audit-logs/',
        expect.objectContaining({
          method: 'GET',
          query: expect.objectContaining({
            start: '2018-02-01T00:00:00.000Z',
            end: '2018-02-28T23:59:59.999Z',
          }),
        })
      );
    });

    expect(await screen.findByText('project.edit')).toBeInTheDocument();
    expect(screen.getByText('org.edit')).toBeInTheDocument();
    expect(screen.getAllByText('127.0.0.1')).toHaveLength(2);
    expect(
      screen.getByText(textWithMarkupMatcher('edited project ludic-science'))
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'edited the organization setting(s): accountRateLimit from 1000 to 0'
      )
    ).toBeInTheDocument();
  });
});
