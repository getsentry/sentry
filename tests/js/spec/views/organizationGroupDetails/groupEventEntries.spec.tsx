import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import {Error} from 'app/components/events/errors';
import EventEntries from 'app/components/events/eventEntries';
import {EntryType, Event} from 'app/types/event';

const {organization, project} = initializeOrg();

// @ts-expect-error
const api = new MockApiClient();

async function renderComponent(event: Event, errors?: Array<Error>) {
  const wrapper = mountWithTheme(
    <EventEntries
      organization={organization}
      event={{...event, errors: errors ?? event.errors}}
      project={project}
      location={location}
      api={api}
    />
  );

  // @ts-expect-error
  await tick();
  wrapper.update();

  const eventErrors = wrapper.find('Errors');

  const bannerSummary = eventErrors.find('BannerSummary');
  const bannerSummaryInfo = bannerSummary.find(
    'span[data-test-id="errors-banner-summary-info"]'
  );

  const toggleButton = bannerSummary
    .find('[data-test-id="event-error-toggle"]')
    .hostNodes();

  toggleButton.simulate('click');

  // @ts-expect-error
  await tick();
  wrapper.update();

  const errorItem = wrapper.find('ErrorItem');

  return {bannerSummaryInfoText: bannerSummaryInfo.text(), errorItem};
}

describe('GroupEventEntries', function () {
  // @ts-expect-error
  const event = TestStubs.Event();

  beforeEach(() => {
    // @ts-expect-error
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/events/${event.id}/grouping-info/`,
      body: {},
    });
    // @ts-expect-error
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/files/dsyms/`,
      body: [],
    });
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

      const {bannerSummaryInfoText, errorItem} = await renderComponent(event, errors);

      expect(bannerSummaryInfoText).toEqual(
        `There were ${errors.length} errors encountered while processing this event`
      );
      expect(errorItem.length).toBe(2);
      expect(errorItem.at(0).props().error).toEqual(errors[0]);
      expect(errorItem.at(1).props().error).toEqual(errors[1]);
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

        const {errorItem, bannerSummaryInfoText} = await renderComponent(newEvent);

        expect(bannerSummaryInfoText).toEqual(
          'There was 1 error encountered while processing this event'
        );

        expect(errorItem.length).toBe(1);
        expect(errorItem.at(0).props().error).toEqual({
          type: 'proguard_missing_mapping',
          message: 'A proguard mapping file was missing.',
          data: {mapping_uuid: proGuardUuid},
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

        const {bannerSummaryInfoText, errorItem} = await renderComponent(newEvent);

        expect(bannerSummaryInfoText).toEqual(
          'There was 1 error encountered while processing this event'
        );

        expect(errorItem.length).toBe(1);
        expect(errorItem.at(0).props().error).toEqual({
          type: 'proguard_missing_mapping',
          message: 'A proguard mapping file was missing.',
          data: {mapping_uuid: proGuardUuid},
        });
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

          const {bannerSummaryInfoText, errorItem} = await renderComponent(newEvent);

          expect(bannerSummaryInfoText).toEqual(
            'There was 1 error encountered while processing this event'
          );

          expect(errorItem.length).toBe(1);
          const {type, message} = errorItem.at(0).props().error;
          expect(type).toEqual('proguard_potentially_misconfigured_plugin');
          expect(message).toBeTruthy();
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

          const {bannerSummaryInfoText, errorItem} = await renderComponent(newEvent);

          expect(bannerSummaryInfoText).toEqual(
            'There was 1 error encountered while processing this event'
          );

          expect(errorItem.length).toBe(1);
          const {type, message} = errorItem.at(0).props().error;
          expect(type).toEqual('proguard_potentially_misconfigured_plugin');
          expect(message).toBeTruthy();
        });
      });
    });
  });
});
