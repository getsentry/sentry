import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Content} from 'sentry/components/events/interfaces/crashContent/exception/content';
import {EntryType} from 'sentry/types';
import {STACK_TYPE, STACK_VIEW} from 'sentry/types/stacktrace';

describe('Exception Content', function () {
  it('display redacted values from exception entry', async function () {
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
                          rem: [['project:3', 's', 0, 0]],
                          len: 43,
                        },
                      },
                    },
                  },
                  value: {
                    '': {
                      rem: [['project:3', 's', 0, 0]],
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
      />
    );

    expect(screen.getAllByText(/redacted/)).toHaveLength(2);

    userEvent.hover(screen.getAllByText(/redacted/)[0]);
    expect(
      await screen.findByText('Replaced because of PII rule "project:3"')
    ).toBeInTheDocument(); // tooltip description
  });
});
