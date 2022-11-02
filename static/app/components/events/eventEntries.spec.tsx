import {initializeData} from 'sentry-test/performance/initializePerformanceData';
import {act, render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import type {Error} from 'sentry/components/events/errors';
import EventEntries from 'sentry/components/events/eventEntries';
import {Group, IssueCategory} from 'sentry/types';
import {EntryType, Event} from 'sentry/types/event';

const {organization, project} = initializeData({
  features: ['performance-issues'],
});

const api = new MockApiClient();

async function renderComponent(event: Event, errors?: Array<Error>) {
  render(
    <EventEntries
      organization={organization}
      event={{...event, errors: errors ?? event.errors}}
      project={project}
      location={location}
      api={api}
    />
  );

  const alertSummaryInfo = await screen.findByTestId('event-error-alert');
  userEvent.click(alertSummaryInfo);
  const errorItems = await screen.findAllByTestId('event-error-item');

  return {alertSummaryInfo, errorItem: errorItems};
}

describe('EventEntries', function () {
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
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/projects/${organization.slug}/${project.slug}/events/${event.id}/committers/`,
      body: {
        committers: [],
      },
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
      const group: Group = TestStubs.Group({issueCategory: IssueCategory.PERFORMANCE});

      const newEvent = {
        ...event,
        entries: [{type: EntryType.SPANS, data: []}],
      };

      render(
        <EventEntries
          organization={organization}
          event={newEvent}
          project={project}
          location={location}
          api={api}
          group={group}
        />,
        {organization}
      );

      const resourcesHeadingText = screen.getByRole('heading', {
        name: /resources and whatever/i,
      });

      expect(resourcesHeadingText).toBeInTheDocument();
    });

    it('injects the resources section in the correct spot', function () {
      const group: Group = TestStubs.Group({issueCategory: IssueCategory.PERFORMANCE});
      group.issueCategory = IssueCategory.PERFORMANCE;
      const sampleBreadcrumb = {
        type: 'default',
        timestamp: '2022-09-19T19:29:32.261000Z',
        level: 'info',
        message: 'span.css-1hs7lfd.e1b8u3ky1 > svg',
        category: 'ui.click',
        data: null,
        event_id: null,
      };

      const newEvent = {
        ...event,
        title: 'test',
        perfProblem: {parentSpanIds: ['a'], causeSpanIds: ['a'], offenderSpanIds: ['a']},
        entries: [
          {type: EntryType.SPANS, data: [{span_id: 'a'}]},
          {type: EntryType.BREADCRUMBS, data: {values: [sampleBreadcrumb]}},
          {type: EntryType.REQUEST, data: {}},
        ],
      };

      render(
        <EventEntries
          organization={organization}
          event={newEvent}
          project={project}
          location={location}
          api={api}
          group={group}
        />
      );

      const eventEntriesContainer = screen.getByTestId('event-entries-loading-false');
      const spanEvidenceHeading = within(eventEntriesContainer).getByRole('heading', {
        name: /span evidence/i,
      });
      const breadcrumbsHeading = within(eventEntriesContainer).getByRole('heading', {
        name: /breadcrumbs/i,
      });
      const resourcesHeadingText = screen.getByRole('heading', {
        name: /resources and whatever/i,
      });

      expect(spanEvidenceHeading).toBeInTheDocument();
      expect(breadcrumbsHeading).toBeInTheDocument();
      expect(resourcesHeadingText).toBeInTheDocument();

      expect(
        within(eventEntriesContainer.children[0] as HTMLElement).getByRole('heading', {
          name: /span evidence/i,
        })
      ).toBeInTheDocument();

      expect(
        within(eventEntriesContainer.children[1] as HTMLElement).getByRole('heading', {
          name: /breadcrumbs/i,
        })
      ).toBeInTheDocument();

      expect(
        within(eventEntriesContainer.children[2] as HTMLElement).getByRole('heading', {
          name: /resources and whatever/i,
        })
      ).toBeInTheDocument();
    });
  });
});
