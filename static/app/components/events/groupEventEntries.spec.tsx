import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {Error} from 'sentry/components/events/errors';
import EventEntries from 'sentry/components/events/eventEntries';
import {Group, IssueCategory} from 'sentry/types';
import {EntryType, Event} from 'sentry/types/event';
import {OrganizationContext} from 'sentry/views/organizationContext';
import {RouteContext} from 'sentry/views/routeContext';

const {organization, project, router} = initializeOrg();
organization.features.push('performance-issues');

const api = new MockApiClient();

async function renderComponent(event: Event, errors?: Array<Error>) {
  render(
    <OrganizationContext.Provider value={organization}>
      <RouteContext.Provider
        value={{
          router,
          location: router.location,
          params: {},
          routes: [],
        }}
      >
        <EventEntries
          organization={organization}
          event={{...event, errors: errors ?? event.errors}}
          project={project}
          location={location}
          api={api}
        />
      </RouteContext.Provider>
    </OrganizationContext.Provider>
  );

  const alertSummaryInfo = await screen.findByTestId('event-error-alert');
  userEvent.click(alertSummaryInfo);
  const errorItems = await screen.findAllByTestId('event-error-item');

  return {alertSummaryInfo, errorItem: errorItems};
}

describe('GroupEventEntries', function () {
  const event = TestStubs.Event();

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/events/${event.id}/grouping-info/`,
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/files/dsyms/`,
      body: [],
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  describe('EventError', function () {
    it('renders', async function () {
      const errors: Array<Error> = [
        {
          type: 'invalid_data',
          data: {
            name: 'logentry',
          },
          message: 'no message present',
        },
        {
          type: 'invalid_data',
          data: {
            name: 'breadcrumbs.values.2.data',
          },
          message: 'expected an object',
        },
      ];

      const {alertSummaryInfo, errorItem} = await renderComponent(event, errors);

      expect(alertSummaryInfo).toHaveTextContent(
        `There were ${errors.length} problems processing this event`
      );
      expect(errorItem.length).toBe(2);
      expect(screen.getByText(errors[0].data?.name!)).toBeInTheDocument();
      expect(screen.getByText(errors[1].data?.name!)).toBeInTheDocument();
    });

    describe('Proguard erros', function () {
      const proGuardUuid = 'a59c8fcc-2f27-49f8-af9e-02661fc3e8d7';

      it('Missing mapping file', async function () {
        const newEvent = {
          ...event,
          platform: 'java',
          entries: [
            {
              type: EntryType.DEBUGMETA,
              data: {
                images: [{type: 'proguard', uuid: proGuardUuid}],
              },
            },
          ],
        };

        await act(async () => {
          const {errorItem, alertSummaryInfo} = await renderComponent(newEvent);

          expect(alertSummaryInfo).toHaveTextContent(
            'There was 1 problem processing this event'
          );

          expect(errorItem.length).toBe(1);
          expect(
            screen.getByText('A proguard mapping file was missing.')
          ).toBeInTheDocument();

          userEvent.click(screen.getByRole('button', {name: 'Expand'}));

          expect(await screen.findByText(proGuardUuid)).toBeInTheDocument();
        });
      });

      it("Don't display extra proguard errors, if the entry error of an event has an error of type 'proguard_missing_mapping'", async function () {
        const newEvent = {
          ...event,
          platform: 'java',
          entries: [
            {
              type: EntryType.DEBUGMETA,
              data: {
                images: [{type: 'proguard', uuid: proGuardUuid}],
              },
            },
          ],
          errors: [
            {
              type: 'proguard_missing_mapping',
              message: 'A proguard mapping file was missing.',
              data: {mapping_uuid: proGuardUuid},
            },
          ],
        };

        const {alertSummaryInfo, errorItem} = await renderComponent(newEvent);

        expect(alertSummaryInfo).toHaveTextContent(
          'There was 1 problem processing this event'
        );

        expect(errorItem.length).toBe(1);
        expect(
          screen.getByText('A proguard mapping file was missing.')
        ).toBeInTheDocument();

        userEvent.click(screen.getByRole('button', {name: 'Expand'}));

        expect(await screen.findByText(proGuardUuid)).toBeInTheDocument();
      });

      describe('ProGuard Plugin seems to not be correctly configured', function () {
        it('find minified data in the exception entry', async function () {
          const newEvent = {
            ...event,
            platform: 'java',
            entries: [
              {
                type: 'exception',
                data: {
                  values: [
                    {
                      stacktrace: {
                        frames: [
                          {
                            function: null,
                            colNo: null,
                            vars: {},
                            symbol: null,
                            module: 'a.$a.a.a',
                          },
                        ],
                        framesOmitted: null,
                        registers: null,
                        hasSystemFrames: false,
                      },
                      module: null,
                      rawStacktrace: null,
                      mechanism: null,
                      threadId: null,
                      value: 'Unexpected token else',
                      type: 'SyntaxError',
                    },
                  ],
                  excOmitted: null,
                  hasSystemFrames: false,
                },
              },
            ],
          };

          const {alertSummaryInfo, errorItem} = await renderComponent(newEvent);

          expect(alertSummaryInfo).toHaveTextContent(
            'There was 1 problem processing this event'
          );

          expect(errorItem.length).toBe(1);
          expect(
            screen.getByText('Some frames appear to be minified. Did you configure the')
          ).toBeInTheDocument();

          expect(
            screen.getByText('No additional details are available for this frame.')
          ).toBeInTheDocument();
        });

        it('find minified data in the threads entry', async function () {
          const newEvent = {
            ...event,
            platform: 'java',
            entries: [
              {
                type: 'exception',
                data: {
                  values: [
                    {
                      stacktrace: {
                        frames: [
                          {
                            function: null,
                            colNo: null,
                            vars: {},
                            symbol: null,
                            module: 'a.$a.a.a',
                          },
                        ],
                        framesOmitted: null,
                        registers: null,
                        hasSystemFrames: false,
                      },
                      module: null,
                      rawStacktrace: null,
                      mechanism: null,
                      threadId: null,
                      value: 'Unexpected token else',
                      type: 'SyntaxError',
                    },
                  ],
                  excOmitted: null,
                  hasSystemFrames: false,
                },
              },
              {
                type: 'threads',
                data: {
                  values: [
                    {
                      stacktrace: {
                        frames: [
                          {
                            function: 'start',
                            package: 'libdyld.dylib',
                            module: 'a.$a.a.a',
                          },
                          {
                            function: 'main',
                            package: 'iOS-Swift',
                            module: '',
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            ],
          };

          const {alertSummaryInfo, errorItem} = await renderComponent(newEvent);

          expect(alertSummaryInfo).toHaveTextContent(
            'There was 1 problem processing this event'
          );

          expect(errorItem.length).toBe(1);
          expect(
            screen.getByText('Some frames appear to be minified. Did you configure the')
          ).toBeInTheDocument();

          expect(screen.getByText('Sentry Gradle Plugin')).toBeInTheDocument();
        });
      });
    });
  });
  describe('Rendering', function () {
    it('renders the Resources section for Performance Issues', function () {
      const group: Group = TestStubs.Group();
      group.issueCategory = IssueCategory.PERFORMANCE;

      const span = {
        timestamp: 1663622615.702273,
        start_timestamp: 1663622613.598782,
        exclusive_time: 0.055,
        description: 'getsentry.middleware.HealthCheck.__call__',
        op: 'django.middleware',
        span_id: '9faa08cee4958058',
        parent_span_id: '995b4e0436421667',
        trace_id: '963a64d67f33418d842102e90fbf2658',
        tags: {
          'django.function_name': 'django.utils.deprecation.MiddlewareMixin.__call__',
          'django.middleware_name': 'getsentry.middleware.HealthCheck',
        },
        hash: '410f212e9e071c82',
        same_process_as_parent: true,
      };

      const newEvent = {
        ...event,
        entries: [{type: EntryType.SPANS, data: [span]}],
      };

      render(
        <OrganizationContext.Provider value={organization}>
          <RouteContext.Provider
            value={{
              router,
              location: router.location,
              params: {},
              routes: [],
            }}
          >
            <EventEntries
              organization={organization}
              event={newEvent}
              project={project}
              location={location}
              api={api}
              group={group}
            />
          </RouteContext.Provider>
        </OrganizationContext.Provider>
      );

      const resourcesHeadingText = screen.getByRole('heading', {
        name: /resources and whatever/i,
      });

      expect(resourcesHeadingText).toBeInTheDocument();
    });
  });
});
