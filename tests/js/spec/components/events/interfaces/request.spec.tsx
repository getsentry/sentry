import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Request} from 'sentry/components/events/interfaces/request';

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
                    rem: [['project:3', 's', 0, 0]],
                    len: 1,
                    chunks: [
                      {
                        type: 'redaction',
                        text: '',
                        rule_id: 'project:3',
                        remark: 's',
                      },
                    ],
                  },
                },
                c: {
                  0: {
                    d: {
                      '': {
                        rem: [['project:3', 's', 0, 0]],
                        len: 1,
                        chunks: [
                          {
                            type: 'redaction',
                            text: '',
                            rule_id: 'project:3',
                            remark: 's',
                          },
                        ],
                      },
                    },
                    f: {
                      '': {
                        rem: [['project:3', 's', 0, 0]],
                        len: 1,
                        chunks: [
                          {
                            type: 'redaction',
                            text: '',
                            rule_id: 'project:3',
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
                    rem: [['project:3', 's', 0, 0]],
                    len: 78,
                    chunks: [
                      {
                        type: 'redaction',
                        text: '',
                        rule_id: 'project:3',
                        remark: 's',
                      },
                    ],
                  },
                },
                REMOTE_ADDR: {
                  '': {
                    rem: [['project:3', 's', 0, 0]],
                    len: 3,
                    chunks: [
                      {
                        type: 'redaction',
                        text: '',
                        rule_id: 'project:3',
                        remark: 's',
                      },
                    ],
                  },
                },
                SERVER_NAME: {
                  '': {
                    rem: [['project:3', 's', 0, 0]],
                    len: 7,
                    chunks: [
                      {
                        type: 'redaction',
                        text: '',
                        rule_id: 'project:3',
                        remark: 's',
                      },
                    ],
                  },
                },
                SERVER_PORT: {
                  '': {
                    rem: [['project:3', 's', 0, 0]],
                    len: 5,
                    chunks: [
                      {
                        type: 'redaction',
                        text: '',
                        rule_id: 'project:3',
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

    render(<Request type="request" event={event} data={event.entries[0].data} />);

    expect(screen.getAllByText(/redacted/)).toHaveLength(5);

    userEvent.click(await screen.findByLabelText('Expand'));

    expect(screen.getAllByText(/redacted/)).toHaveLength(7);

    userEvent.hover(screen.getAllByText(/redacted/)[0]);

    expect(
      await screen.findByText('Replaced because of PII rule "project:3"')
    ).toBeInTheDocument(); // tooltip description
  });
});
