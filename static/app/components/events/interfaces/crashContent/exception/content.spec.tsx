import {DataScrubbingRelayPiiConfigFixture} from 'sentry-fixture/dataScrubbingRelayPiiConfig';
import {EventFixture} from 'sentry-fixture/event';
import {EventEntryExceptionGroupFixture} from 'sentry-fixture/eventEntryExceptionGroup';
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
      {organization: org, router}
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

  it('respects platform overrides in stacktrace frames', function () {
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
      />
    );

    // Cocoa override should render a native stack trace component
    expect(screen.getByTestId('native-stack-trace-content')).toBeInTheDocument();

    // Other stacktrace should render the normal stack trace (python)
    expect(screen.getByTestId('stack-trace-content')).toBeInTheDocument();
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
      render(<Content {...defaultProps} />);

      const exceptions = screen.getAllByTestId('exception-value');

      // First exception should be the parent ExceptionGroup
      expect(within(exceptions[0]!).getByText('ExceptionGroup 1')).toBeInTheDocument();
      expect(
        within(exceptions[0]!).getByRole('heading', {name: 'ExceptionGroup 1'})
      ).toBeInTheDocument();
    });

    it('displays exception group tree in first frame when there is no other context', function () {
      render(<Content {...defaultProps} />);

      const exceptions = screen.getAllByTestId('exception-value');

      const exceptionGroupWithNoContext = exceptions[2]!;
      expect(
        within(exceptionGroupWithNoContext).getByText('Related Exceptions')
      ).toBeInTheDocument();
    });

    it('collapses sub-groups by default', async function () {
      render(<Content {...defaultProps} />);

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

    it('auto-opens sub-groups when clicking link in tree', async function () {
      render(<Content {...defaultProps} />);

      expect(screen.queryByRole('heading', {name: 'ValueError'})).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', {name: /ValueError: test/i}));

      // After expanding, ValueError should be visible
      expect(screen.getByRole('heading', {name: 'ValueError'})).toBeInTheDocument();
    });
  });
});
