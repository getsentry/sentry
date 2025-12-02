import {DataScrubbingRelayPiiConfigFixture} from 'sentry-fixture/dataScrubbingRelayPiiConfig';
import {EventFixture} from 'sentry-fixture/event';
import {
  EventEntryChainedExceptionFixture,
  EventEntryExceptionGroupFixture,
} from 'sentry-fixture/eventEntryChainedException';
import {EventStacktraceFrameFixture} from 'sentry-fixture/eventStacktraceFrame';
import {GitHubIntegrationFixture} from 'sentry-fixture/githubIntegration';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RepositoryFixture} from 'sentry-fixture/repository';
import {RepositoryProjectPathConfigFixture} from 'sentry-fixture/repositoryProjectPathConfig';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {Content} from 'sentry/components/events/interfaces/crashContent/exception/content';
import {LineCoverageProvider} from 'sentry/components/events/interfaces/crashContent/exception/lineCoverageContext';
import ProjectsStore from 'sentry/stores/projectsStore';
import {EntryType} from 'sentry/types/event';
import {CodecovStatusCode, Coverage} from 'sentry/types/integrations';
import {StackType, StackView} from 'sentry/types/stacktrace';

describe('Exception Content', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture();
  const integration = GitHubIntegrationFixture();
  const repo = RepositoryFixture({integrationId: integration.id});
  const config = RepositoryProjectPathConfigFixture({project, repo, integration});

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/prompts-activity/`,
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/stacktrace-link/`,
      body: {config, sourceUrl: 'https://something.io', integrations: [integration]},
    });
    ProjectsStore.loadInitialData([project]);
  });

  it('display redacted values from exception entry', async () => {
    const projectDetails = ProjectFixture({
      ...project,
      relayPiiConfig: JSON.stringify(DataScrubbingRelayPiiConfigFixture()),
    });
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/${project.slug}/`,
      body: projectDetails,
    });

    const {organization: org} = initializeOrg({
      projects: [project],
    });

    const event = EventFixture({
      _meta: {
        entries: {
          0: {
            data: {
              values: {
                '0': {
                  mechanism: {
                    data: {
                      relevant_address: {
                        '': {
                          rem: [['project:0', 's', 0, 0]],
                          len: 43,
                        },
                      },
                    },
                  },
                  value: {
                    '': {
                      rem: [['project:0', 's', 0, 0]],
                      len: 43,
                    },
                  },
                },
              },
            },
          },
        },
      },
      entries: [
        {
          type: EntryType.EXCEPTION,
          data: {
            values: [
              {
                mechanism: {
                  type: 'celery',
                  handled: false,
                  data: {relevant_address: null},
                },
                module: 'sentry.models.organization',
                rawStacktrace: null,
                stacktrace: {
                  frames: [
                    {
                      function: null,
                      colNo: null,
                      vars: {},
                      symbol: null,
                      module: '<unknown module>',
                      lineNo: null,
                      package: null,
                      absPath:
                        'https://sentry.io/hiventy/kraken-prod/issues/438681831/?referrer=slack#',
                      inApp: false,
                      instructionAddr: null,
                      filename: '/hiventy/kraken-prod/issues/438681831/',
                      platform: null,
                      context: [],
                      symbolAddr: null,
                    },
                  ],
                  framesOmitted: null,
                  registers: null,
                  hasSystemFrames: false,
                },
                threadId: null,
                type: 'Organization.DoesNotExist',
                value: null,
              },
            ],
          },
        },
      ],
    });

    render(
      <Content
        type={StackType.ORIGINAL}
        groupingCurrentLevel={0}
        newestFirst
        stackView={StackView.APP}
        event={event}
        values={event.entries[0]!.data.values}
        meta={event._meta!.entries[0].data.values}
        projectSlug={project.slug}
      />,
      {
        organization: org,
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${org.slug}/issues/`,
            query: {project: project.id},
          },
          route: '/organizations/:orgId/issues/',
        },
      }
    );

    expect(screen.getAllByText(/redacted/)).toHaveLength(2);

    await userEvent.hover(screen.getAllByText(/redacted/)[0]!);

    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          'Replaced because of the data scrubbing rule [Replace] [Password fields] with [Scrubbed] from [password] in the settings of the project project-slug'
        )
      )
    ).toBeInTheDocument(); // tooltip description

    expect(
      screen.getByRole('link', {
        name: '[Replace] [Password fields] with [Scrubbed] from [password]',
      })
    ).toHaveAttribute(
      'href',
      '/settings/org-slug/projects/project-slug/security-and-privacy/advanced-data-scrubbing/0/'
    );

    expect(screen.getByRole('link', {name: 'project-slug'})).toHaveAttribute(
      'href',
      '/settings/org-slug/projects/project-slug/security-and-privacy/'
    );
  });

  it('respects platform overrides in stacktrace frames', () => {
    const event = EventFixture({
      projectID: project.id,
      platform: 'python',
      entries: [
        {
          type: EntryType.EXCEPTION,
          data: {
            values: [
              {
                stacktrace: {
                  frames: [EventStacktraceFrameFixture({platform: null})],
                },
              },
              {
                stacktrace: {
                  frames: [EventStacktraceFrameFixture({platform: 'cocoa'})],
                },
              },
            ],
          },
        },
      ],
    });

    render(
      <Content
        type={StackType.ORIGINAL}
        stackView={StackView.APP}
        event={event}
        values={event.entries[0]!.data.values}
        projectSlug={project.slug}
        newestFirst
      />,
      {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/issues/`,
            query: {},
          },
          route: '/organizations/:orgId/issues/',
        },
      }
    );

    // Cocoa override should render a native stack trace component
    expect(screen.getByTestId('native-stack-trace-content')).toBeInTheDocument();

    // Other stacktrace should render the normal stack trace (python)
    expect(screen.getByTestId('stack-trace-content')).toBeInTheDocument();
  });

  it('does not use fold section for non-chained exceptions', () => {
    const event = EventFixture({
      projectID: project.id,
      entries: [
        {
          type: EntryType.EXCEPTION,
          data: {
            excOmitted: null,
            hasSystemFrames: false,
            values: [
              {
                type: 'ValueError',
                value: 'test',
                mechanism: {
                  handled: true,
                  type: '',
                },
                stacktrace: {
                  framesOmitted: null,
                  hasSystemFrames: false,
                  registers: null,
                  frames: [
                    {
                      function: 'func4',
                      module: 'helpers',
                      filename: 'file4.py',
                      absPath: 'file4.py',
                      lineNo: 50,
                      colNo: null,
                      context: [[50, 'raise ValueError("test")']],
                      inApp: true,
                      rawFunction: null,
                      package: null,
                      platform: null,
                      instructionAddr: null,
                      symbol: null,
                      symbolAddr: null,
                      trust: null,
                      vars: null,
                    },
                  ],
                },
                module: 'helpers',
                threadId: null,
                rawStacktrace: null,
              },
            ],
          },
        },
      ],
    });
    render(
      <Content
        type={StackType.ORIGINAL}
        stackView={StackView.APP}
        event={event}
        values={event.entries[0]!.data.values}
        projectSlug={project.slug}
        newestFirst
      />,
      {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/issues/`,
            query: {},
          },
          route: '/organizations/:orgId/issues/',
        },
      }
    );

    expect(screen.getByRole('heading', {name: 'ValueError'})).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Collapse Section'})
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'View Section'})).not.toBeInTheDocument();
  });

  describe('exception groups', () => {
    const event = EventFixture({
      entries: [EventEntryExceptionGroupFixture()],
      projectID: project.id,
    });

    beforeEach(() => {
      MockApiClient.clearMockResponses();

      const promptResponse = {
        dismissed_ts: undefined,
        snoozed_ts: undefined,
      };
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/prompts-activity/`,
        body: promptResponse,
      });
      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/stacktrace-link/`,
        body: {config, sourceUrl: 'https://something.io', integrations: [integration]},
      });
      ProjectsStore.loadInitialData([project]);
    });

    const defaultProps = {
      type: StackType.ORIGINAL,
      newestFirst: true,
      platform: 'python' as const,
      stackView: StackView.APP,
      event,
      values: event.entries[0]!.data.values,
      projectSlug: project.slug,
    };

    it('displays exception group tree under first exception', () => {
      render(<Content {...defaultProps} />, {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/issues/`,
            query: {},
          },
          route: '/organizations/:orgId/issues/',
        },
      });

      expect(
        screen.getByText('There are 4 chained exceptions in this event.')
      ).toBeInTheDocument();
      const exceptions = screen.getAllByTestId('exception-value');

      // First exception should be the parent ExceptionGroup
      expect(within(exceptions[0]!).getByText('ExceptionGroup 1')).toBeInTheDocument();
      expect(
        within(exceptions[0]!).getByRole('heading', {name: 'ExceptionGroup 1'})
      ).toBeInTheDocument();
      expect(within(exceptions[0]!).getByText('Related Exceptions')).toBeInTheDocument();
    });

    it('displays exception group tree in first frame when there is no other context', () => {
      render(<Content {...defaultProps} />, {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/issues/`,
            query: {},
          },
          route: '/organizations/:orgId/issues/',
        },
      });

      const exceptions = screen.getAllByTestId('exception-value');

      const exceptionGroupWithNoContext = exceptions[2]!;
      expect(
        within(exceptionGroupWithNoContext).getByText('Related Exceptions')
      ).toBeInTheDocument();
    });

    it('hides sub-groups by default', async () => {
      render(<Content {...defaultProps} />, {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/issues/`,
            query: {},
          },
          route: '/organizations/:orgId/issues/',
        },
      });

      // There are 4 values, but 1 should be hidden
      expect(screen.getAllByTestId('exception-value')).toHaveLength(3);
      expect(screen.queryByRole('heading', {name: 'ValueError'})).not.toBeInTheDocument();

      await userEvent.click(
        screen.getByRole('button', {name: /show 1 related exception/i})
      );

      // After expanding, ValueError should be visible
      expect(screen.getAllByTestId('exception-value')).toHaveLength(4);
      expect(screen.getByRole('heading', {name: 'ValueError'})).toBeInTheDocument();

      await userEvent.click(
        screen.getByRole('button', {name: /hide 1 related exception/i})
      );

      // After collapsing, ValueError should be gone again
      expect(screen.getAllByTestId('exception-value')).toHaveLength(3);
      expect(screen.queryByRole('heading', {name: 'ValueError'})).not.toBeInTheDocument();
    });

    it('auto-opens sub-groups when clicking link in tree', async () => {
      render(<Content {...defaultProps} />, {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/issues/`,
            query: {},
          },
          route: '/organizations/:orgId/issues/',
        },
      });

      expect(screen.queryByRole('heading', {name: 'ValueError'})).not.toBeInTheDocument();

      expect(
        screen.getByRole('button', {name: /show 1 related exception/i})
      ).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', {name: /ValueError: test/i}));

      // After expanding, ValueError should be visible
      expect(screen.getByRole('heading', {name: 'ValueError'})).toBeInTheDocument();
    });
  });

  describe('chained exceptions', () => {
    const event = EventFixture({
      entries: [EventEntryChainedExceptionFixture()],
      projectID: project.id,
    });

    beforeEach(() => {
      MockApiClient.clearMockResponses();

      const promptResponse = {
        dismissed_ts: undefined,
        snoozed_ts: undefined,
      };
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/prompts-activity/`,
        body: promptResponse,
      });
      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/stacktrace-link/`,
        body: {config, sourceUrl: 'https://something.io', integrations: [integration]},
      });
      ProjectsStore.loadInitialData([project]);
    });

    const defaultProps = {
      type: StackType.ORIGINAL,
      newestFirst: true,
      platform: 'python' as const,
      stackView: StackView.APP,
      event,
      values: event.entries[0]!.data.values,
      projectSlug: project.slug,
    };

    it('only expands the first 3 exceptions by default', () => {
      render(<Content {...defaultProps} />, {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/issues/`,
            query: {},
          },
          route: '/organizations/:orgId/issues/',
        },
      });

      // both toggle headings are visible because they are not exception group chained exceptions
      expect(screen.getByRole('heading', {name: 'ValueError'})).toBeInTheDocument();
      expect(screen.getByRole('heading', {name: 'TypeError'})).toBeInTheDocument();
      expect(screen.getByRole('heading', {name: 'RuntimeError'})).toBeInTheDocument();
      expect(screen.getByRole('heading', {name: 'SyntaxError'})).toBeInTheDocument();

      // only ValueError is expanded by default
      expect(screen.getAllByRole('button', {name: 'Collapse Section'})).toHaveLength(3);
      expect(screen.getAllByRole('button', {name: 'View Section'})).toHaveLength(1);

      // does not show exception group UI elements
      expect(screen.queryByText('Related Exceptions')).not.toBeInTheDocument();
    });

    it('can expand and collapse all exceptions', async () => {
      render(<Content {...defaultProps} />, {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/issues/`,
            query: {},
          },
          route: '/organizations/:orgId/issues/',
        },
      });

      const collapseButtons = screen.getAllByRole('button', {name: 'Collapse Section'});
      for (const button of collapseButtons) {
        await userEvent.click(button);
      }

      // all exceptions are collapsed
      expect(
        screen.queryByRole('button', {name: 'Collapse Section'})
      ).not.toBeInTheDocument();
      expect(screen.getAllByRole('button', {name: 'View Section'})).toHaveLength(4);
    });
  });

  describe('line coverage', () => {
    it('shows line coverage legend when coverage data is available', async () => {
      const orgWithCodecov = OrganizationFixture({codecovAccess: true});
      const event = EventFixture({
        projectID: project.id,
        entries: [
          {
            type: EntryType.EXCEPTION,
            data: {
              values: [
                {
                  type: 'ValueError',
                  value: 'test',
                  stacktrace: {
                    frames: [
                      {
                        function: 'func4',
                        filename: 'file4.py',
                        absPath: '/path/to/file4.py',
                        lineNo: 50,
                        context: [
                          [48, 'def func4():'],
                          [49, '    try:'],
                          [50, 'raise ValueError("test")'],
                          [51, '    except:'],
                          [52, '        pass'],
                        ],
                        inApp: true,
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      });

      MockApiClient.addMockResponse({
        url: `/projects/${orgWithCodecov.slug}/${project.slug}/stacktrace-coverage/`,
        body: {
          status: CodecovStatusCode.COVERAGE_EXISTS,
          coverageUrl: 'https://codecov.io/gh/owner/repo/file4.py',
          lineCoverage: [
            [48, Coverage.NOT_APPLICABLE],
            [49, Coverage.COVERED],
            [50, Coverage.NOT_COVERED],
            [51, Coverage.COVERED],
            [52, Coverage.PARTIAL],
          ],
        },
      });

      render(
        <LineCoverageProvider>
          <Content
            type={StackType.ORIGINAL}
            stackView={StackView.APP}
            event={event}
            values={event.entries[0]!.data.values}
            projectSlug={project.slug}
            newestFirst
          />
        </LineCoverageProvider>,
        {
          organization: orgWithCodecov,
          initialRouterConfig: {
            location: {
              pathname: `/organizations/${orgWithCodecov.slug}/issues/`,
              query: {},
            },
            route: '/organizations/:orgId/issues/',
          },
        }
      );

      // The frame should be expanded
      const toggleButton = screen.queryByRole('button', {name: 'Toggle Context'});
      expect(toggleButton).toBeInTheDocument();
      expect(toggleButton).toHaveAttribute('data-test-id', 'toggle-button-expanded');

      // The frame context and line coverage legend should be visible
      expect(await screen.findByText('def func4():')).toBeInTheDocument();
      expect(await screen.findByText('Line covered by tests')).toBeInTheDocument();
      expect(await screen.findByText('Line uncovered by tests')).toBeInTheDocument();
      expect(
        await screen.findByText('Line partially covered by tests')
      ).toBeInTheDocument();
    });
  });
});
