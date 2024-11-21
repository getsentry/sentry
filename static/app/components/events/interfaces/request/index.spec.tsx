import {DataScrubbingRelayPiiConfigFixture} from 'sentry-fixture/dataScrubbingRelayPiiConfig';
import {EventFixture} from 'sentry-fixture/event';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {Request} from 'sentry/components/events/interfaces/request';
import ConfigStore from 'sentry/stores/configStore';
import type {EntryRequest} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';

jest.unmock('prismjs');

describe('Request entry', function () {
  beforeEach(() => {
    ConfigStore.set('user', UserFixture());
  });

  it('display redacted data', async function () {
    const event = EventFixture({
      entries: [
        {
          type: 'request',
          data: {
            env: {
              DOCUMENT_ROOT: '',
              REMOTE_ADDR: '',
              SERVER_NAME: '',
              SERVER_PORT: '',
            },
            method: 'POST',
            query: [],
            url: '/Home/PostIndex',
            inferredContentType: null,
            fragment: null,
            headers: [],
            cookies: [],
            data: [
              {
                a: '',
                c: [
                  {
                    d: '',
                    f: '',
                  },
                ],
              },
            ],
          },
        },
      ],
      _meta: {
        entries: {
          0: {
            data: {
              '': null,
              method: null,
              url: null,
              query: null,
              data: {
                0: {
                  a: {
                    '': {
                      rem: [['organization:0', 's', 0, 0]],
                      len: 1,
                      chunks: [
                        {
                          type: 'redaction',
                          text: '',
                          rule_id: 'organization:0',
                          remark: 's',
                        },
                      ],
                    },
                  },
                  c: {
                    0: {
                      d: {
                        '': {
                          rem: [['organization:0', 's', 0, 0]],
                          len: 1,
                          chunks: [
                            {
                              type: 'redaction',
                              text: '',
                              rule_id: 'organization:0',
                              remark: 's',
                            },
                          ],
                        },
                      },
                      f: {
                        '': {
                          rem: [['organization:0', 's', 0, 0]],
                          len: 1,
                          chunks: [
                            {
                              type: 'redaction',
                              text: '',
                              rule_id: 'organization:0',
                              remark: 's',
                            },
                          ],
                        },
                      },
                    },
                  },
                },
              },
              env: {
                DOCUMENT_ROOT: {
                  '': {
                    rem: [['organization:0', 's', 0, 0]],
                    len: 78,
                    chunks: [
                      {
                        type: 'redaction',
                        text: '',
                        rule_id: 'organization:0',
                        remark: 's',
                      },
                    ],
                  },
                },
                REMOTE_ADDR: {
                  '': {
                    rem: [['organization:0', 's', 0, 0]],
                    len: 3,
                    chunks: [
                      {
                        type: 'redaction',
                        text: '',
                        rule_id: 'organization:0',
                        remark: 's',
                      },
                    ],
                  },
                },
                SERVER_NAME: {
                  '': {
                    rem: [['organization:0', 's', 0, 0]],
                    len: 7,
                    chunks: [
                      {
                        type: 'redaction',
                        text: '',
                        rule_id: 'organization:0',
                        remark: 's',
                      },
                    ],
                  },
                },
                SERVER_PORT: {
                  '': {
                    rem: [['organization:0', 's', 0, 0]],
                    len: 5,
                    chunks: [
                      {
                        type: 'redaction',
                        text: '',
                        rule_id: 'organization:0',
                        remark: 's',
                      },
                    ],
                  },
                },
              },
            },
          },
        },
      },
    });

    render(<Request event={event} data={event.entries[0].data} />, {
      organization: {
        relayPiiConfig: JSON.stringify(DataScrubbingRelayPiiConfigFixture()),
      },
    });

    expect(screen.getAllByText(/redacted/)).toHaveLength(5);

    // Expand two levels down
    await userEvent.click(await screen.findByLabelText('Expand'));
    await userEvent.click(await screen.findByLabelText('Expand'));

    expect(screen.getAllByText(/redacted/)).toHaveLength(7);

    await userEvent.hover(screen.getAllByText(/redacted/)[0]);

    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          "Replaced because of the data scrubbing rule [Replace] [Password fields] with [Scrubbed] from [password] in your organization's settings"
        )
      )
    ).toBeInTheDocument(); // tooltip description
  });

  describe('body section', function () {
    it('should return plain-text when given unrecognized inferred Content-Type', function () {
      const data: EntryRequest['data'] = {
        apiTarget: null,
        query: [],
        data: 'helloworld',
        headers: [],
        cookies: [],
        env: {},
        inferredContentType: null,
        method: 'POST',
        url: '/Home/PostIndex',
        fragment: null,
      };

      const event = EventFixture({
        entries: [
          {
            type: EntryType.REQUEST,
            data,
          },
        ],
      });

      render(<Request event={event} data={event.entries[0].data} />, {
        organization: {
          relayPiiConfig: JSON.stringify(DataScrubbingRelayPiiConfigFixture()),
        },
      });

      expect(
        screen.getByTestId('rich-http-content-body-section-pre')
      ).toBeInTheDocument();
    });

    it('should return a KeyValueList element when inferred Content-Type is x-www-form-urlencoded', function () {
      const data: EntryRequest['data'] = {
        apiTarget: null,
        query: [],
        data: {foo: ['bar'], bar: ['baz']},
        headers: [],
        cookies: [],
        env: {},
        inferredContentType: 'application/x-www-form-urlencoded',
        method: 'POST',
        url: '/Home/PostIndex',
        fragment: null,
      };

      const event = EventFixture({
        entries: [
          {
            type: EntryType.REQUEST,
            data,
          },
        ],
      });

      render(<Request event={event} data={event.entries[0].data} />, {
        organization: {
          relayPiiConfig: JSON.stringify(DataScrubbingRelayPiiConfigFixture()),
        },
      });

      expect(
        screen.getByTestId('rich-http-content-body-key-value-list')
      ).toBeInTheDocument();
    });

    it('should return a ContextData element when inferred Content-Type is application/json', function () {
      const data: EntryRequest['data'] = {
        apiTarget: null,
        query: [],
        data: {foo: 'bar'},
        headers: [],
        cookies: [],
        env: {},
        inferredContentType: 'application/json',
        method: 'POST',
        url: '/Home/PostIndex',
        fragment: null,
      };

      const event = EventFixture({
        entries: [
          {
            type: EntryType.REQUEST,
            data,
          },
        ],
      });

      render(<Request event={event} data={event.entries[0].data} />, {
        organization: {
          relayPiiConfig: JSON.stringify(DataScrubbingRelayPiiConfigFixture()),
        },
      });

      expect(
        screen.getByTestId('rich-http-content-body-context-data')
      ).toBeInTheDocument();
    });

    it('should not blow up in a malformed uri', function () {
      // > decodeURIComponent('a%AFc')
      // URIError: URI malformed
      const data: EntryRequest['data'] = {
        apiTarget: null,
        query: 'a%AFc',
        data: '',
        headers: [],
        cookies: [],
        env: {},
        method: 'POST',
        url: '/Home/PostIndex',
        fragment: null,
      };

      const event = EventFixture({
        entries: [
          {
            type: EntryType.REQUEST,
            data,
          },
        ],
      });

      expect(() =>
        render(<Request event={event} data={event.entries[0].data} />, {
          organization: {
            relayPiiConfig: JSON.stringify(DataScrubbingRelayPiiConfigFixture()),
          },
        })
      ).not.toThrow();
    });

    it('should remove any non-tuple values from array', function () {
      const user = UserFixture();
      user.options.prefersIssueDetailsStreamlinedUI = true;
      ConfigStore.set('user', user);

      const data: EntryRequest['data'] = {
        apiTarget: null,
        query: 'a%AFc',
        data: '',
        headers: [['foo', 'bar'], null],
        cookies: [],
        env: {},
        method: 'POST',
        url: '/Home/PostIndex',
      };
      const event = EventFixture({
        entries: [
          {
            type: EntryType.REQUEST,
            data,
          },
        ],
      });
      expect(() =>
        render(<Request event={event} data={event.entries[0].data} />, {
          organization: {
            relayPiiConfig: JSON.stringify(DataScrubbingRelayPiiConfigFixture()),
          },
        })
      ).not.toThrow();
    });

    it("should not cause an invariant violation if data.data isn't a string", function () {
      const data: EntryRequest['data'] = {
        apiTarget: null,
        query: [],
        data: [{foo: 'bar', baz: 1}],
        headers: [],
        cookies: [],
        env: {},
        method: 'POST',
        url: '/Home/PostIndex',
        fragment: null,
      };

      const event = EventFixture({
        entries: [
          {
            type: EntryType.REQUEST,
            data,
          },
        ],
      });

      expect(() =>
        render(<Request event={event} data={event.entries[0].data} />, {
          organization: {
            relayPiiConfig: JSON.stringify(DataScrubbingRelayPiiConfigFixture()),
          },
        })
      ).not.toThrow();
    });

    describe('graphql', function () {
      it('should render a graphql query and variables', function () {
        const data: EntryRequest['data'] = {
          apiTarget: 'graphql',
          method: 'POST',
          url: '/graphql/',
          data: {
            query: 'query Test { test }',
            variables: {foo: 'bar'},
            operationName: 'Test',
          },
        };

        const event = EventFixture({
          entries: [
            {
              type: EntryType.REQUEST,
              data,
            },
          ],
        });

        render(<Request event={event} data={event.entries[0].data} />);

        expect(screen.getByText('query Test { test }')).toBeInTheDocument();
        expect(screen.getByRole('row', {name: 'operationName Test'})).toBeInTheDocument();
        expect(
          screen.getByRole('row', {name: 'variables { foo : bar }'})
        ).toBeInTheDocument();
      });

      it('highlights graphql query lines with errors', async function () {
        const data: EntryRequest['data'] = {
          apiTarget: 'graphql',
          method: 'POST',
          url: '/graphql/',
          data: {
            query: 'query Test { test }',
            variables: {foo: 'bar'},
            operationName: 'Test',
          },
        };

        const event = EventFixture({
          entries: [
            {
              type: EntryType.REQUEST,
              data,
            },
          ],
          contexts: {
            response: {
              data: {
                errors: [{message: 'Very bad error', locations: [{line: 1, column: 2}]}],
              },
            },
          },
        });

        const {container} = render(
          <Request event={event} data={event.entries[0].data} />
        );

        expect(container.querySelector('.line-highlight')).toBeInTheDocument();
        expect(
          container.querySelector('.line-highlight')?.getAttribute('data-start')
        ).toBe('1');
        expect(
          screen.getByText('There was 1 GraphQL error raised during this request.')
        ).toBeInTheDocument();

        await userEvent.click(screen.getByText(/There was 1 GraphQL error/i));

        expect(screen.getByText('Line 1 Column 2: Very bad error')).toBeInTheDocument();
      });
    });
  });
});
