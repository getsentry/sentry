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
        rows: [
          {
            id: '4500000',
            actor: UserFixture(),
            event: 'project.remove',
            ipAddress: '127.0.0.1',
            note: 'removed project test',
            targetObject: 5466660,
            targetUser: null,
            data: {},
            dateCreated: '2021-09-28T00:29:33.940848Z',
          },
          {
            id: '430000',
            actor: UserFixture(),
            event: 'org.create',
            ipAddress: '127.0.0.1',
            note: 'created the organization',
            targetObject: 54215,
            targetUser: null,
            data: {},
            dateCreated: '2016-11-21T04:02:45.929313Z',
          },
        ],
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

    expect(await screen.findByText('project.remove')).toBeInTheDocument();
    expect(screen.getByText('org.create')).toBeInTheDocument();
    expect(screen.getAllByText('127.0.0.1')).toHaveLength(2);
    expect(screen.getByText('12:29 AM UTC')).toBeInTheDocument();
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
        rows: [
          {
            id: '4500002',
            actor: UserFixture(),
            event: 'member.invite',
            ipAddress: '10.0.0.1',
            note: 'invited member test@example.com',
            targetObject: 5466662,
            targetUser: null,
            data: {},
            dateCreated: '2021-09-30T00:29:33.940848Z',
          },
        ],
        options: AuditLogsApiEventNamesFixture(),
      },
    });

    const {router} = initializeOrg({
      projects: [],
      router: {
        params: {orgId: 'org-slug'},
        location: {
          query: {
            start: '2021-09-01T00:00:00.000Z',
            end: '2021-09-30T23:59:59.999Z',
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
            start: '2021-09-01T00:00:00.000Z',
            end: '2021-09-30T23:59:59.999Z',
          }),
        })
      );
    });

    expect(await screen.findByText('member.invite')).toBeInTheDocument();
    expect(screen.getByText('invited member test@example.com')).toBeInTheDocument();
    expect(screen.getByText('10.0.0.1')).toBeInTheDocument();
  });
});
