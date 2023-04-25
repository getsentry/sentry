import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {Content} from 'sentry/components/events/interfaces/crashContent/exception/content';
import ProjectsStore from 'sentry/stores/projectsStore';
import {EntryType} from 'sentry/types';
import {STACK_TYPE, STACK_VIEW} from 'sentry/types/stacktrace';

describe('Exception Content', function () {
  it('display redacted values from exception entry', async function () {
    const project = TestStubs.Project({
      id: '0',
      relayPiiConfig: JSON.stringify(TestStubs.DataScrubbingRelayPiiConfig()),
    });

    const {organization, router, routerContext} = initializeOrg({
      ...initializeOrg(),
      router: {
        location: {query: {project: '0'}},
      },
      project: '0',
      projects: [project],
    });

    ProjectsStore.loadInitialData([project]);

    const event = {
      ...TestStubs.Event(),
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
                      errors: null,
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
    };

    render(
      <Content
        type={STACK_TYPE.ORIGINAL}
        groupingCurrentLevel={0}
        hasHierarchicalGrouping
        newestFirst
        platform="python"
        stackView={STACK_VIEW.APP}
        event={event}
        values={event.entries[0].data.values}
        meta={event._meta.entries[0].data.values}
        projectSlug={project.slug}
      />,
      {organization, router, context: routerContext}
    );

    expect(screen.getAllByText(/redacted/)).toHaveLength(2);

    await userEvent.hover(screen.getAllByText(/redacted/)[0]);

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

  describe('exception groups', function () {
    const event = TestStubs.Event({entries: [TestStubs.EventEntryExceptionGroup()]});
    const project = TestStubs.Project();

    const defaultProps = {
      type: STACK_TYPE.ORIGINAL,
      hasHierarchicalGrouping: false,
      newestFirst: true,
      platform: 'python' as const,
      stackView: STACK_VIEW.APP,
      event,
      values: event.entries[0].data.values,
      projectSlug: project.slug,
    };

    it('displays exception group tree in first frame', function () {
      render(<Content {...defaultProps} />);

      const exceptions = screen.getAllByTestId('exception-value');

      // There are 4 exceptions in the exception group fixture
      expect(exceptions).toHaveLength(4);

      // First exception should be the parent ExceptionGroup and the tree should be visible
      // in the top frame context
      expect(
        within(exceptions[0]).getByRole('heading', {name: 'ExceptionGroup 1'})
      ).toBeInTheDocument();
      const exception1FrameContext = within(exceptions[0]).getByTestId('frame-context');
      expect(
        within(exception1FrameContext).getByRole('cell', {name: 'Related Exceptions'})
      ).toBeInTheDocument();
    });

    it('displays exception group tree in first frame when sorting by oldest', function () {
      render(<Content {...defaultProps} newestFirst={false} />);

      const exceptions = screen.getAllByTestId('exception-value');

      // Last exception should be the parent ExceptionGroup and the tree should be visible
      // in the top frame context
      expect(
        within(exceptions[3]).getByRole('heading', {name: 'ExceptionGroup 1'})
      ).toBeInTheDocument();
      const exception1FrameContext = within(exceptions[3]).getByTestId('frame-context');
      expect(
        within(exception1FrameContext).getByRole('cell', {name: 'Related Exceptions'})
      ).toBeInTheDocument();
    });

    it('displays exception group tree in first frame when there is no other context', function () {
      render(<Content {...defaultProps} />);

      const exceptions = screen.getAllByTestId('exception-value');

      const exceptionGroupWithNoContext = exceptions[2];
      expect(
        within(exceptionGroupWithNoContext).getByRole('cell', {
          name: 'Related Exceptions',
        })
      ).toBeInTheDocument();
    });
  });
});
