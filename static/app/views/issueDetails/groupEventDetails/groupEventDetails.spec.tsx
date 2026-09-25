import {QueryClientProvider} from '@tanstack/react-query';
import {AutofixSetupFixture} from 'sentry-fixture/autofixSetupFixture';
import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {
  SourceMapDebugFrameFixture,
  SourceMapDebugReleaseProcessFixture,
  SourceMapDebugResponseFixture,
} from 'sentry-fixture/sourceMapDebug';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
  within,
  type RouterConfig,
} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {Event} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {IssueCategory, IssueType} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import GroupEventDetails from 'sentry/views/issueDetails/groupEventDetails/groupEventDetails';
import type {TraceTree} from 'sentry/views/performance/traceDetails/traceModels/traceTree';
import {
  makeEAPError,
  makeEAPOccurrence,
  makeEAPSpan,
} from 'sentry/views/performance/traceDetails/traceModels/traceTreeTestUtils';

const TRACE_ID = '797cda4e24844bdc90e0efe741616047';

const makeDefaultMockData = (
  organization?: Organization,
  project?: Project,
  query?: Record<string, string | string[]>
): {
  event: Event;
  group: Group;
  initialRouterConfig: RouterConfig;
  organization: Organization;
  project: Project;
} => {
  const group = GroupFixture();
  const org = organization ?? OrganizationFixture();

  return {
    project: project ?? ProjectFixture(),
    organization: org,
    initialRouterConfig: {
      location: {
        pathname: `/organizations/${org.slug}/issues/${group.id}/`,
        query: query ?? {},
      },
      route: '/organizations/:orgId/issues/:groupId/',
    },
    group,
    event: EventFixture({
      size: 1,
      dateCreated: '2019-03-20T00:00:00.000Z',
      errors: [],
      entries: [],
      tags: [
        {key: 'environment', value: 'dev'},
        {key: 'mechanism', value: 'ANR'},
      ],
      contexts: {
        app: {
          app_start_time: '2021-08-31T15:14:21Z',
          device_app_hash: '0b77c3f2567d65fe816e1fa7013779fbe3b51633',
          build_type: 'test',
          app_identifier: 'io.sentry.sample.iOS-Swift',
          app_name: 'iOS-Swift',
          app_version: '7.2.3',
          app_build: '390',
          app_id: 'B2690307-FDD1-3D34-AA1E-E280A9C2406C',
          type: 'app',
        },
        device: {
          family: 'iOS',
          model: 'iPhone13,4',
          model_id: 'D54pAP',
          memory_size: 5987008512,
          free_memory: 154435584,
          usable_memory: 4706893824,
          storage_size: 127881465856,
          boot_time: '2021-08-29T06:05:51Z',
          timezone: 'CEST',
          type: 'device',
        },
        os: {
          name: 'iOS',
          version: '14.7.1',
          build: '18G82',
          kernel_version:
            'Darwin Kernel Version 20.6.0: Mon Jun 21 21:23:35 PDT 2021; root:xnu-7195.140.42~10/RELEASE_ARM64_T8101',
          rooted: false,
          type: 'os',
        },
        trace: {
          trace_id: TRACE_ID,
          span_id: 'b0e6f15b45c36b12',
          op: 'ui.action.click',
          type: 'trace',
        },
        profile: {
          profiler_id: 'a0f6f14c42c36b13',
        },
      },
    }),
  };
};

const mockedTrace = (project: Project): TraceTree.EAPSpan =>
  makeEAPSpan({
    event_id: '8806ea4691c24fc7b1c77ecd78df574f',
    transaction: 'MainActivity.add_attachment',
    transaction_id: '8806ea4691c24fc7b1c77ecd78df574f',
    name: 'MainActivity.add_attachment',
    op: 'navigation',
    project_id: parseInt(project.id, 10),
    project_slug: project.slug,
    parent_span_id: null,
    is_transaction: true,
    start_timestamp: 1678290374.150561,
    end_timestamp: 1678290375.150561,
    errors: [
      makeEAPError({
        event_id: 'c6971a73454646338bc3ec80c70f8891',
        issue_id: 104,
        project_id: parseInt(project.id, 10),
        project_slug: project.slug,
        description: 'ApplicationNotResponding: ANR for at least 5000 ms.',
        level: 'error',
        start_timestamp: 1678290374.150561,
        transaction: 'MainActivity.add_attachment',
      }),
    ],
    occurrences: [
      makeEAPOccurrence({
        event_id: '8806ea4691c24fc7b1c77ecd78df574f',
        issue_id: 110,
        short_id: 'SENTRY-ANDROID-1R',
        project_id: parseInt(project.id, 10),
        project_slug: project.slug,
        description: 'File IO on Main Thread',
        level: 'info',
        culprit: 'MainActivity.add_attachment',
        issue_type: 1008,
        start_timestamp: 1678290374.150562,
        transaction: 'MainActivity.add_attachment',
      }),
    ],
  });

const mockGroupApis = (
  organization: Organization,
  project: Project,
  group: Group,
  event: Event,
  replayId?: string,
  trace?: TraceTree.EAPSpan
) => {
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/issues/1/events/',
    body: [],
  });
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/flags/logs/',
    body: {data: []},
  });
  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/issues/${group.id}/`,
    body: group,
  });

  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/issues/${group.id}/events/recommended/`,
    body: event,
  });

  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/replays/${replayId}/`,
    body: {},
  });

  MockApiClient.addMockResponse({
    url: `/projects/${organization.slug}/${project.slug}/issues/`,
    method: 'PUT',
  });

  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/issues/${group.id}/tags/`,
    body: [],
  });

  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/trace/${TRACE_ID}/`,
    body: trace ? ([trace] satisfies TraceTree.EAPTrace) : [],
  });

  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/issues/${group.id}/integrations/`,
    body: [],
  });

  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/issues/${group.id}/external-issues/`,
    body: [],
  });

  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/issues/${group.id}/current-release/`,
    body: {currentRelease: null},
  });

  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/prompts-activity/`,
    body: {data: {}, features: {issue_feedback_hidden: {}}},
  });

  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/prompts-activity/`,
    method: 'PUT',
  });

  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/has-mobile-app-events/`,
    body: null,
  });

  MockApiClient.addMockResponse({
    url: `/projects/${organization.slug}/${project.slug}/events/${event.id}/grouping-info/`,
    body: {},
  });
  MockApiClient.addMockResponse({
    url: `/projects/${organization.slug}/${project.slug}/codeowners/`,
    body: [],
  });
  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/code-mappings/`,
    method: 'GET',
    body: [],
  });
  MockApiClient.addMockResponse({
    url: `/projects/${organization.slug}/${project.slug}/events/${event.id}/actionable-items/`,
    body: {
      errors: [],
    },
  });

  // Sentry related mocks
  MockApiClient.addMockResponse({
    url: '/sentry-apps/',
    body: [],
  });

  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/sentry-apps/`,
    body: [],
  });

  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/sentry-app-installations/`,
    body: [],
  });

  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/sentry-app-components/`,
    body: [],
    match: [MockApiClient.matchQuery({projectId: project.id})],
  });

  MockApiClient.addMockResponse({
    url: '/projects/org-slug/project-slug/',
    body: project,
  });
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/users/',
    body: [],
  });
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/projects/',
    body: [project],
  });

  MockApiClient.addMockResponse({
    url: '/customers/org-slug/policies/',
    body: {},
  });

  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/issues/${group.id}/first-last-release/`,
    method: 'GET',
  });
  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/events/`,
    body: {
      data: [],
      meta: {fields: {}, units: {}},
    },
  });
  MockApiClient.addMockResponse({
    url: `/projects/${organization.slug}/${project.slug}/`,
    body: project,
  });

  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/issues/${group.id}/autofix/setup/`,
    method: 'GET',
    body: AutofixSetupFixture({
      integration: {
        ok: true,
        reason: null,
      },
    }),
  });
  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/issues/${group.id}/autofix/`,
    body: {
      steps: [],
    },
  });

  MockApiClient.addMockResponse({
    url: '/customers/org-slug/',
    method: 'GET',
    body: {},
  });

  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/profiling/chunks/`,
    body: {
      chunk: {
        profiler_id: event.contexts?.profile?.profiler_id,
      },
    },
  });
};

describe('groupEventDetails', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  describe('source-map issue content', () => {
    function setupSourceMapIssue() {
      const props = makeDefaultMockData();
      props.group = GroupFixture({
        issueCategory: IssueCategory.CONFIGURATION,
        issueType: IssueType.SOURCEMAP_CONFIGURATION,
      });
      props.event = EventFixture({
        sdk: {name: 'sentry.javascript.browser', version: '10.0.0'},
        occurrence: {
          ...EventFixture().occurrence!,
          evidenceData: {sampleEventId: 'sample-event'},
        },
      });
      mockGroupApis(props.organization, props.project, props.group, props.event);
      const diagnosticRequest = MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/events/sample-event/source-map-debug/',
        body: SourceMapDebugResponseFixture({
          dist: 'web-build',
          exceptions: [
            {
              frames: [
                SourceMapDebugFrameFixture({
                  release_process: SourceMapDebugReleaseProcessFixture({
                    source_file_lookup_result: 'wrong-dist',
                  }),
                }),
              ],
            },
          ],
        }),
      });
      const renderPage = () =>
        render(<GroupEventDetails />, {
          organization: props.organization,
          initialRouterConfig: props.initialRouterConfig,
        });
      return {props, diagnosticRequest, renderPage};
    }

    it('renders project content and loads impact before the sample event arrives', async () => {
      jest.useFakeTimers();
      try {
        const {props, diagnosticRequest, renderPage} = setupSourceMapIssue();
        MockApiClient.addMockResponse({
          url: '/organizations/org-slug/issues/1/events/recommended/',
          body: props.event,
          asyncDelay: 1000,
        });
        renderPage();

        const problem = await screen.findByRole('heading', {name: 'Problem'});
        expect(
          screen.getByRole('heading', {name: 'Troubleshooting suggestions'})
        ).toBeInTheDocument();
        expect(
          await screen.findByText('No impacted events found in the last 30 days.')
        ).toBeInTheDocument();
        expect(diagnosticRequest).not.toHaveBeenCalled();
        expect(
          screen.queryByRole('button', {name: 'Copy Event ID'})
        ).not.toBeInTheDocument();

        await act(async () => jest.advanceTimersByTimeAsync(1000));
        expect(
          await screen.findByText(
            textWithMarkupMatcher(
              'The source file ~/static/app.min.js was found but the dist value does not match the uploaded artifact.'
            )
          )
        ).toBeInTheDocument();
        expect(screen.getByRole('heading', {name: 'Problem'})).toBe(problem);
        expect(screen.getByRole('button', {name: 'Copy Event ID'})).toBeInTheDocument();
        expect(screen.getByLabelText('Event timestamp')).toBeInTheDocument();
        expect(screen.getByRole('link', {name: 'JSON'})).toHaveAttribute(
          'href',
          `${props.organization.links.regionUrl}/api/0/projects/${props.organization.slug}/${props.project.slug}/events/${props.event.id}/json/`
        );
      } finally {
        jest.useRealTimers();
      }
    });

    it('copies the event ID from the loaded event header', async () => {
      Object.assign(navigator, {
        clipboard: {writeText: jest.fn().mockResolvedValue(undefined)},
      });
      const {props, renderPage} = setupSourceMapIssue();
      renderPage();

      await userEvent.click(await screen.findByRole('button', {name: 'Copy Event ID'}));

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(props.event.id);
    });

    it.each([404, 500])(
      'keeps project content visible when the event request returns %s',
      async statusCode => {
        const {diagnosticRequest, renderPage} = setupSourceMapIssue();
        MockApiClient.addMockResponse({
          url: '/organizations/org-slug/issues/1/events/recommended/',
          statusCode,
        });
        renderPage();

        expect(await screen.findByRole('heading', {name: 'Problem'})).toBeInTheDocument();
        expect(screen.getByRole('heading', {name: 'Impact'})).toBeInTheDocument();
        expect(
          screen.getByRole('heading', {name: 'Troubleshooting suggestions'})
        ).toBeInTheDocument();
        expect(
          await screen.findByText(
            statusCode === 404
              ? 'No sample event is available for diagnosis. Use the troubleshooting suggestions below.'
              : 'Unable to load a sample event for diagnosis.'
          )
        ).toBeInTheDocument();
        expect(diagnosticRequest).not.toHaveBeenCalled();
        expect(
          screen.queryByRole('button', {name: 'Copy Event ID'})
        ).not.toBeInTheDocument();
        expect(
          screen.queryByText(/couldn't track down an event/)
        ).not.toBeInTheDocument();
      }
    );

    it.each<[string, number]>([
      ['/organizations/org-slug/issues/1/events/recommended/', 404],
      ['/organizations/org-slug/issues/1/events/recommended/', 500],
      ['/projects/org-slug/project-slug/events/sample-event/source-map-debug/', 404],
      ['/projects/org-slug/project-slug/events/sample-event/source-map-debug/', 500],
    ])(
      'keeps the cached diagnosis when %s refresh fails with %s',
      async (url, statusCode) => {
        const {props} = setupSourceMapIssue();
        const queryClient = makeTestQueryClient();
        render(<GroupEventDetails />, {
          organization: props.organization,
          initialRouterConfig: props.initialRouterConfig,
          additionalWrapper: ({children}) => (
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
          ),
        });
        const diagnosis = await screen.findByText(
          textWithMarkupMatcher(
            'The source file ~/static/app.min.js was found but the dist value does not match the uploaded artifact.'
          )
        );
        const failedRefresh = MockApiClient.addMockResponse({url, statusCode});

        jest.useFakeTimers();
        try {
          await act(async () => {
            await queryClient.refetchQueries();
            await jest.advanceTimersByTimeAsync(1);
          });

          expect(failedRefresh).toHaveBeenCalledTimes(1);
          expect(diagnosis).toBeInTheDocument();
          expect(screen.queryByRole('button', {name: 'Retry'})).not.toBeInTheDocument();
          expect(screen.queryByText(/available for diagnosis/)).not.toBeInTheDocument();
        } finally {
          jest.useRealTimers();
        }
      }
    );

    it('retries the sample request and displays its diagnosis', async () => {
      const {props, renderPage} = setupSourceMapIssue();
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/1/events/recommended/',
        statusCode: 500,
      });
      renderPage();
      const retry = await screen.findByRole('button', {name: 'Retry'});

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/1/events/recommended/',
        body: props.event,
      });
      await userEvent.click(retry);
      expect(
        await screen.findByText(
          textWithMarkupMatcher(
            'The source file ~/static/app.min.js was found but the dist value does not match the uploaded artifact.'
          )
        )
      ).toBeInTheDocument();
    });

    it.each([undefined, 'sentry.python'])(
      'keeps general guidance when the sample SDK is %s',
      async sdkName => {
        const {props, diagnosticRequest, renderPage} = setupSourceMapIssue();
        MockApiClient.addMockResponse({
          url: '/organizations/org-slug/issues/1/events/recommended/',
          body: EventFixture({
            ...props.event,
            sdk: sdkName ? {name: sdkName, version: '1.0.0'} : undefined,
          }),
        });
        renderPage();
        expect(
          await screen.findByText(
            'Diagnostic information is unavailable for this sample. Use the troubleshooting suggestions below.'
          )
        ).toBeInTheDocument();
        expect(
          screen.getByRole('button', {name: 'Verify Artifacts Are Uploaded'})
        ).toBeInTheDocument();
        expect(diagnosticRequest).not.toHaveBeenCalled();
      }
    );

    it('does not request diagnostics when the occurrence has no sample ID', async () => {
      const {props, diagnosticRequest, renderPage} = setupSourceMapIssue();
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/1/events/recommended/',
        body: EventFixture({
          ...props.event,
          occurrence: {...props.event.occurrence!, evidenceData: {}},
        }),
      });
      renderPage();
      expect(
        await screen.findByText(
          'Diagnostic information is unavailable for this sample. Use the troubleshooting suggestions below.'
        )
      ).toBeInTheDocument();
      expect(diagnosticRequest).not.toHaveBeenCalled();
    });

    it('keeps the page usable when the diagnostic sample has expired', async () => {
      const {renderPage} = setupSourceMapIssue();
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/events/sample-event/source-map-debug/',
        statusCode: 404,
      });
      renderPage();
      expect(
        await screen.findByText(
          'The sample event is no longer available for diagnosis. Use the troubleshooting suggestions below.'
        )
      ).toBeInTheDocument();
      expect(screen.getByRole('heading', {name: 'Problem'})).toBeInTheDocument();
      expect(screen.getByRole('heading', {name: 'Impact'})).toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: 'Verify Artifacts Are Uploaded'})
      ).toBeInTheDocument();
      expect(screen.queryByRole('button', {name: 'Retry'})).not.toBeInTheDocument();
    });

    it('retries diagnostic failures without reloading the issue page', async () => {
      const {renderPage} = setupSourceMapIssue();
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/events/sample-event/source-map-debug/',
        statusCode: 500,
      });
      renderPage();
      const retry = await screen.findByRole('button', {name: 'Retry'});
      const problem = screen.getByRole('heading', {name: 'Problem'});
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/events/sample-event/source-map-debug/',
        body: SourceMapDebugResponseFixture(),
      });
      await userEvent.click(retry);
      expect(
        await screen.findByRole('button', {name: 'Upload Instructions'})
      ).toBeInTheDocument();
      expect(screen.getByRole('heading', {name: 'Problem'})).toBe(problem);
    });
  });

  it('redirects on switching to an invalid environment selection for event', async () => {
    const props = makeDefaultMockData();
    const eventRouterConfig = {
      ...props.initialRouterConfig,
      location: {
        ...props.initialRouterConfig.location,
        pathname: `/organizations/${props.organization.slug}/issues/${props.group.id}/events/${props.event.id}/`,
      },
      route: '/organizations/:orgId/issues/:groupId/events/:eventId/',
    };
    mockGroupApis(props.organization, props.project, props.group, props.event);

    MockApiClient.addMockResponse({
      url: `/organizations/${props.organization.slug}/issues/${props.group.id}/events/${props.event.id}/`,
      body: props.event,
    });

    const {router} = render(<GroupEventDetails />, {
      organization: props.organization,
      initialRouterConfig: eventRouterConfig,
    });
    expect(await screen.findByTestId('group-event-details')).toBeInTheDocument();

    router.navigate(`${router.location.pathname}?environment=prod`);

    await waitFor(() => {
      expect(router.location).toEqual(
        expect.objectContaining({
          pathname: `/organizations/${props.organization.slug}/issues/${props.group.id}/`,
          query: expect.objectContaining({
            environment: 'prod',
          }),
        })
      );
    });
  });

  it('does not redirect when switching to a valid environment selection for event', async () => {
    const props = makeDefaultMockData();
    mockGroupApis(props.organization, props.project, props.group, props.event);

    const {router} = render(<GroupEventDetails />, {
      organization: props.organization,
      initialRouterConfig: props.initialRouterConfig,
    });

    const initialPathname = router.location.pathname;
    router.navigate(`${initialPathname}?environment=`);

    expect(await screen.findByTestId('group-event-details')).toBeInTheDocument();

    // Should not redirect - pathname should remain the same
    expect(router.location).toEqual(
      expect.objectContaining({
        pathname: initialPathname,
        query: expect.objectContaining({
          environment: '',
        }),
      })
    );
  });

  it('displays error on event error', async () => {
    const props = makeDefaultMockData();

    mockGroupApis(
      props.organization,
      props.project,
      props.group,
      EventFixture({
        size: 1,
        dateCreated: '2019-03-20T00:00:00.000Z',
        errors: [],
        entries: [],
        tags: [{key: 'environment', value: 'dev'}],
        previousEventID: 'prev-event-id',
        nextEventID: 'next-event-id',
      })
    );

    MockApiClient.addMockResponse({
      url: `/organizations/${props.organization.slug}/issues/${props.group.id}/events/recommended/`,
      statusCode: 500,
    });

    render(<GroupEventDetails />, {
      organization: props.organization,
      initialRouterConfig: props.initialRouterConfig,
    });

    expect(await screen.findByText(/couldn't track down an event/)).toBeInTheDocument();
  });

  it('renders the Span Evidence section for Performance Issues', async () => {
    const props = makeDefaultMockData();
    const group = GroupFixture({
      issueCategory: IssueCategory.PERFORMANCE,
      issueType: IssueType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES,
    });
    const transactionEvent = EventFixture({
      entries: [{type: EntryType.SPANS, data: []}],
      contexts: {
        trace: {
          trace_id: TRACE_ID,
          span_id: 'b0e6f15b45c36b12',
          type: 'trace',
        },
      },
    });

    mockGroupApis(props.organization, props.project, group, transactionEvent);

    render(<GroupEventDetails />, {
      organization: props.organization,
      initialRouterConfig: props.initialRouterConfig,
    });

    expect(
      await screen.findByRole('region', {name: 'Span Evidence'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Collapse Span Evidence Section'})
    ).toBeInTheDocument();
  });

  it('renders the Function Evidence section for Profile Issues', async () => {
    const props = makeDefaultMockData();
    const group = GroupFixture({
      issueCategory: IssueCategory.PERFORMANCE,
      issueType: IssueType.PROFILE_FILE_IO_MAIN_THREAD,
    });
    const transactionEvent = EventFixture({
      entries: [],
      occurrence: {
        evidenceDisplay: [],
        evidenceData: {
          templateName: 'profile',
        },
        type: 2001,
      },
    });

    mockGroupApis(props.organization, props.project, group, transactionEvent);

    render(<GroupEventDetails />, {
      organization: props.organization,
      initialRouterConfig: props.initialRouterConfig,
    });

    expect(
      await screen.findByRole('region', {name: 'Function Evidence'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Collapse Function Evidence Section'})
    ).toBeInTheDocument();
  });

  it('renders event tags ui', async () => {
    const {organization, project, group, event, initialRouterConfig} =
      makeDefaultMockData();
    mockGroupApis(organization, project, group, event);
    render(<GroupEventDetails />, {
      organization,
      initialRouterConfig,
    });

    expect(await screen.findByRole('region', {name: 'Tags'})).toBeInTheDocument();
    const highlights = screen.getByRole('region', {name: 'Highlights'});

    expect(within(highlights).getByRole('button', {name: 'Edit'})).toBeInTheDocument();
    // No highlights setup
    expect(
      await within(highlights).findByRole('button', {name: 'Add Highlights'})
    ).toBeInTheDocument();
    expect(screen.getByText("There's nothing here...")).toBeInTheDocument();
  });

  describe('ANR Root Cause', () => {
    beforeEach(() => {
      MockApiClient.clearMockResponses();
    });
    it('shows anr root cause', async () => {
      const props = makeDefaultMockData();
      mockGroupApis(
        props.organization,
        props.project,
        props.group,
        props.event,
        undefined,
        mockedTrace(props.project)
      );

      render(<GroupEventDetails />, {
        organization: props.organization,
        initialRouterConfig: props.initialRouterConfig,
      });

      expect(
        await screen.findByRole('region', {name: 'Suspect Root Cause'})
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: 'Collapse Suspect Root Cause Section'})
      ).toBeInTheDocument();
      expect(screen.getByText('File IO on Main Thread')).toBeInTheDocument();
    });

    it('shows ANR profile section for Android ANR events', async () => {
      const project = ProjectFixture({platform: 'android'});
      const props = makeDefaultMockData(undefined, project);
      ProjectsStore.loadInitialData([props.project]);
      mockGroupApis(
        props.organization,
        props.project,
        props.group,
        props.event,
        undefined,
        mockedTrace(props.project)
      );

      render(<GroupEventDetails />, {
        organization: props.organization,
        initialRouterConfig: props.initialRouterConfig,
      });

      expect(
        await screen.findByRole('region', {name: 'profile-preview'})
      ).toBeInTheDocument();
      expect(screen.getByText('ANR Profile')).toBeInTheDocument();
    });

    it('renders App Hang profile section for iOS ANR events', async () => {
      const project = ProjectFixture({platform: 'apple-ios'});
      const props = makeDefaultMockData(undefined, project);
      ProjectsStore.loadInitialData([props.project]);

      mockGroupApis(
        props.organization,
        props.project,
        props.group,
        props.event,
        undefined,
        mockedTrace(props.project)
      );

      render(<GroupEventDetails />, {
        organization: props.organization,
        initialRouterConfig: props.initialRouterConfig,
      });

      expect(
        await screen.findByRole('region', {name: 'profile-preview'})
      ).toBeInTheDocument();
      expect(screen.getByText('App Hang Profile')).toBeInTheDocument();
    });

    it('does not render ANR profile section for js events', async () => {
      const project = ProjectFixture({platform: 'javascript-electron'});
      const props = makeDefaultMockData(undefined, project);
      ProjectsStore.loadInitialData([props.project]);

      mockGroupApis(
        props.organization,
        props.project,
        props.group,
        props.event,
        undefined,
        mockedTrace(props.project)
      );

      render(<GroupEventDetails />, {
        organization: props.organization,
        initialRouterConfig: props.initialRouterConfig,
      });

      // Wait for component to render by checking for an element that should be present
      expect(await screen.findByTestId('group-event-details')).toBeInTheDocument();

      // Check that profile-preview does not exist
      expect(
        screen.queryByRole('region', {name: 'profile-preview'})
      ).not.toBeInTheDocument();
    });

    it('does not render root cause section if related perf issues do not exist', async () => {
      const props = makeDefaultMockData();
      const trace = mockedTrace(props.project);
      mockGroupApis(
        props.organization,
        props.project,
        props.group,
        props.event,
        undefined,
        {
          ...trace,
          occurrences: [],
        }
      );

      render(<GroupEventDetails />, {
        organization: props.organization,
        initialRouterConfig: props.initialRouterConfig,
      });

      // mechanism: ANR
      expect(await screen.findByText('ANR')).toBeInTheDocument();
      expect(
        screen.queryByRole('region', {name: 'Suspect Root Cause'})
      ).not.toBeInTheDocument();
      expect(screen.queryByText('File IO on Main Thread')).not.toBeInTheDocument();
    });
  });
});
