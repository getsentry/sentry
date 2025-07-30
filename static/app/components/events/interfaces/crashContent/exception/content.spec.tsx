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
import ProjectsStore from 'sentry/stores/projectsStore';
import {EntryType} from 'sentry/types/event';
import {StackType, StackView} from 'sentry/types/stacktrace';

describe('Exception Content', function () {
  const organization = OrganizationFixture();
  const project = ProjectFixture();
  const integration = GitHubIntegrationFixture();
  const repo = RepositoryFixture({integrationId: integration.id});
  const config = RepositoryProjectPathConfigFixture({project, repo, integration});

  beforeEach(function () {
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

  it('display redacted values from exception entry', async function () {
    const projectDetails = ProjectFixture({
      ...project,
      relayPiiConfig: JSON.stringify(DataScrubbingRelayPiiConfigFixture()),
    });
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/${project.slug}/`,
      body: projectDetails,
    });

    const {organization: org, router} = initializeOrg({
      router: {
        location: {query: {project: project.id}},
      },
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
        router,
        deprecatedRouterMocks: true,
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

  it('respects platform overrides in stacktrace frames', async function () {
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
        deprecatedRouterMocks: true,
      }
    );

    // Cocoa override should render a native stack trace component
    expect(screen.getByTestId('native-stack-trace-content')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'View Section'}));

    // Other stacktrace should render the normal stack trace (python)
    expect(screen.getByTestId('stack-trace-content')).toBeInTheDocument();
  });

  it('does not use fold section for non-chained exceptions', function () {
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
      {deprecatedRouterMocks: true}
    );

    expect(screen.getByRole('heading', {name: 'ValueError'})).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Collapse Section'})
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'View Section'})).not.toBeInTheDocument();
  });

  describe('exception groups', function () {
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

    it('displays exception group tree under first exception', function () {
      render(<Content {...defaultProps} />, {
        deprecatedRouterMocks: true,
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

    it('hides sub-groups by default', async function () {
      render(<Content {...defaultProps} />, {
        deprecatedRouterMocks: true,
      });

      // There are 4 values, but 3 should be hidden
      // 2 of them are children of the visible exception group, 1 is a child of
      // one of the children of the visible exception group
      expect(screen.getAllByTestId('exception-value')).toHaveLength(1);
      expect(screen.queryByRole('heading', {name: 'TypeError'})).not.toBeInTheDocument();

      await userEvent.click(
        screen.getByRole('button', {name: /show 2 related exceptions/i})
      );

      // After expanding, the outermost exception group's children should be visible, but not
      // any further descendants
      expect(screen.getAllByTestId('exception-value')).toHaveLength(3);

      await userEvent.click(
        screen.getByRole('button', {name: /hide 2 related exceptions/i})
      );

      // After hiding, the outermost exception group's children should be hidden again
      expect(screen.getAllByTestId('exception-value')).toHaveLength(1);
    });

    it('auto-opens sub-groups when clicking link in tree', async function () {
      render(<Content {...defaultProps} />, {
        deprecatedRouterMocks: true,
      });

      expect(screen.queryByText('Hide 2 related exceptions')).not.toBeInTheDocument();
      expect(screen.getByText('Show 2 related exceptions')).toBeInTheDocument();
      expect(screen.queryByRole('heading', {name: 'TypeError'})).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', {name: /TypeError: nested/i}));

      // After expanding, TypeError should be visible and toggle copy should change
      expect(screen.getByText('Hide 2 related exceptions')).toBeInTheDocument();
      expect(screen.queryByText('Show 2 related exceptions')).not.toBeInTheDocument();
      expect(screen.getByRole('heading', {name: 'TypeError'})).toBeInTheDocument();
    });
  });

  describe('chained exceptions', function () {
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

    it('only expands root cause exception by default', function () {
      render(<Content {...defaultProps} />, {
        deprecatedRouterMocks: true,
      });

      // both toggle headings are visible because they are not exception group chained exceptions
      expect(screen.getByRole('heading', {name: 'ValueError'})).toBeInTheDocument();
      expect(screen.getByRole('heading', {name: 'TypeError'})).toBeInTheDocument();

      // only ValueError is expanded by default
      expect(screen.getAllByRole('button', {name: 'Collapse Section'})).toHaveLength(1);
      expect(screen.getAllByRole('button', {name: 'View Section'})).toHaveLength(1);

      // does not show exception group UI elements
      expect(screen.queryByText('Related Exceptions')).not.toBeInTheDocument();
    });

    it('can expand and collapse all exceptions', async function () {
      render(<Content {...defaultProps} />, {
        deprecatedRouterMocks: true,
      });

      await userEvent.click(screen.getByRole('button', {name: 'View Section'}));

      // all exceptions are expanded
      expect(screen.getAllByRole('button', {name: 'Collapse Section'})).toHaveLength(2);
      expect(
        screen.queryByRole('button', {name: 'View Section'})
      ).not.toBeInTheDocument();

      const collapseButtons = screen.getAllByRole('button', {name: 'Collapse Section'});
      for (const button of collapseButtons) {
        await userEvent.click(button);
      }

      // all exceptions are collapsed
      expect(
        screen.queryByRole('button', {name: 'Collapse Section'})
      ).not.toBeInTheDocument();
      expect(screen.getAllByRole('button', {name: 'View Section'})).toHaveLength(2);
    });
  });
});
