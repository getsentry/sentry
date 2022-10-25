import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {Request} from 'sentry/components/events/interfaces/request';
import {EntryRequest, EntryType} from 'sentry/types/event';

describe('Request entry', function () {
  it('display redacted data', async function () {
    const event = {
      ...TestStubs.Event(),
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
    };

    render(<Request event={event} data={event.entries[0].data} />, {
      organization: {
        relayPiiConfig: JSON.stringify(TestStubs.DataScrubbingRelayPiiConfig()),
      },
    });

    expect(screen.getAllByText(/redacted/)).toHaveLength(5);

    userEvent.click(await screen.findByLabelText('Expand'));

    expect(screen.getAllByText(/redacted/)).toHaveLength(7);

    userEvent.hover(screen.getAllByText(/redacted/)[0]);

    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          "Replaced because of the data scrubbing rule [Replace] [Password fields] with [Scrubbed] from [password] in your organization's settings"
        )
      )
    ).toBeInTheDocument(); // tooltip description
  });

  describe('getBodySection', function () {
    it('should return plain-text when given unrecognized inferred Content-Type', function () {
      const data: EntryRequest['data'] = {
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

      const event = {
        ...TestStubs.Event(),
        entries: [
          {
            type: EntryType.REQUEST,
            data,
          },
        ],
      };

      render(<Request event={event} data={event.entries[0].data} />, {
        organization: {
          relayPiiConfig: JSON.stringify(TestStubs.DataScrubbingRelayPiiConfig()),
        },
      });

      expect(
        screen.getByTestId('rich-http-content-body-section-pre')
      ).toBeInTheDocument();
    });

    it('should return a KeyValueList element when inferred Content-Type is x-www-form-urlencoded', function () {
      const data: EntryRequest['data'] = {
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

      const event = {
        ...TestStubs.Event(),
        entries: [
          {
            type: EntryType.REQUEST,
            data,
          },
        ],
      };

      render(<Request event={event} data={event.entries[0].data} />, {
        organization: {
          relayPiiConfig: JSON.stringify(TestStubs.DataScrubbingRelayPiiConfig()),
        },
      });

      expect(
        screen.getByTestId('rich-http-content-body-key-value-list')
      ).toBeInTheDocument();
    });

    it('should return a ContextData element when inferred Content-Type is application/json', function () {
      const data: EntryRequest['data'] = {
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

      const event = {
        ...TestStubs.Event(),
        entries: [
          {
            type: EntryType.REQUEST,
            data,
          },
        ],
      };

      render(<Request event={event} data={event.entries[0].data} />, {
        organization: {
          relayPiiConfig: JSON.stringify(TestStubs.DataScrubbingRelayPiiConfig()),
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
        query: 'a%AFc',
        data: '',
        headers: [],
        cookies: [],
        env: {},
        method: 'POST',
        url: '/Home/PostIndex',
        fragment: null,
      };

      const event = {
        ...TestStubs.Event(),
        entries: [
          {
            type: EntryType.REQUEST,
            data,
          },
        ],
      };

      expect(() =>
        render(<Request event={event} data={event.entries[0].data} />, {
          organization: {
            relayPiiConfig: JSON.stringify(TestStubs.DataScrubbingRelayPiiConfig()),
          },
        })
      ).not.toThrow();
    });

    it("should not cause an invariant violation if data.data isn't a string", function () {
      const data: EntryRequest['data'] = {
        query: [],
        data: [{foo: 'bar', baz: 1}],
        headers: [],
        cookies: [],
        env: {},
        method: 'POST',
        url: '/Home/PostIndex',
        fragment: null,
      };

      const event = {
        ...TestStubs.Event(),
        entries: [
          {
            type: EntryType.REQUEST,
            data,
          },
        ],
      };

      expect(() =>
        render(<Request event={event} data={event.entries[0].data} />, {
          organization: {
            relayPiiConfig: JSON.stringify(TestStubs.DataScrubbingRelayPiiConfig()),
          },
        })
      ).not.toThrow();
    });
  });
});
