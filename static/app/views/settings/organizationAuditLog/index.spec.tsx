import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import ConfigStore from 'sentry/stores/configStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import {Config, User} from 'sentry/types';
import OrganizationAuditLog from 'sentry/views/settings/organizationAuditLog';

describe('OrganizationAuditLog', function () {
  const user: User = {
    ...TestStubs.User(),
    options: {
      clock24Hours: true,
      timezone: 'America/Los_Angeles',
    },
  };

  const config: Config = {...ConfigStore.getState(), user};

  beforeEach(() => {
    ConfigStore.loadInitialData(config);
  });

  it('renders', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/audit-logs/`,
      method: 'GET',
      body: {
        rows: [
          {
            id: '4500000',
            actor: TestStubs.User(),
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
            actor: TestStubs.User(),
            event: 'org.create',
            ipAddress: '127.0.0.1',
            note: 'created the organization',
            targetObject: 54215,
            targetUser: null,
            data: {},
            dateCreated: '2016-11-21T04:02:45.929313Z',
          },
        ],
        options: TestStubs.AuditLogsApiEventNames(),
      },
    });

    const {routerContext, router} = initializeOrg({
      projects: [],
      router: {
        params: {orgId: 'org-slug'},
      },
    });

    render(<OrganizationAuditLog location={router.location} />, {
      context: routerContext,
    });

    expect(await screen.findByText('project.remove')).toBeInTheDocument();
    expect(screen.getByText('org.create')).toBeInTheDocument();
    expect(screen.getAllByText('127.0.0.1')).toHaveLength(2);
    expect(screen.getByText('17:29 PDT')).toBeInTheDocument();
  });

  it('Displays pretty dynamic sampling logs', async function () {
    const {routerContext, router, project, projects, organization} = initializeOrg({
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
            actor: TestStubs.User(),
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
            actor: TestStubs.User(),
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
        options: TestStubs.AuditLogsApiEventNames(),
      },
    });

    render(<OrganizationAuditLog location={router.location} />, {
      context: routerContext,
    });

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
});
