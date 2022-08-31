import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import EventExtraData from 'sentry/components/events/eventExtraData';

describe('EventExtraData', function () {
  it('display redacted data', async function () {
    const event = {
      ...TestStubs.Event(),
      context: {
        'sys.argv': ['', '', '', '', '', '', '', '', '', ''],
        sdk: {
          clientIP: '127.0.0.1',
          version: '3.16.1',
          name: 'raven-js',
          upstream: {
            url: 'https://docs.sentry.io/clients/javascript/',
            isNewer: '\n',
          },
        },
      },
      _meta: {
        context: {
          'sys.argv': {
            '0': {
              '': {
                rem: [['project:3', 's', 0, 0]],
                len: 49,
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
            '1': {
              '': {
                rem: [['project:3', 's', 0, 0]],
                len: 17,
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
            '2': {
              '': {
                rem: [['project:3', 's', 0, 0]],
                len: 12,
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
            '3': {
              '': {
                rem: [['project:3', 's', 0, 0]],
                len: 8,
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
            '4': {
              '': {
                rem: [['project:3', 's', 0, 0]],
                len: 30,
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
            '5': {
              '': {
                rem: [['project:3', 's', 0, 0]],
                len: 8,
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
            '6': {
              '': {
                rem: [['project:3', 's', 0, 0]],
                len: 18,
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
            '7': {
              '': {
                rem: [['project:3', 's', 0, 0]],
                len: 8,
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
            '8': {
              '': {
                rem: [['project:3', 's', 0, 0]],
                len: 26,
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
            '9': {
              '': {
                rem: [['project:3', 's', 0, 0]],
                len: 8,
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
            '': {
              len: 14,
            },
          },
        },
      },
    };
    render(<EventExtraData event={event} />);

    expect(screen.getAllByText(/redacted/)).toHaveLength(10);

    userEvent.hover(screen.getAllByText(/redacted/)[0]);

    expect(
      await screen.findByText('Replaced because of PII rule "project:3"')
    ).toBeInTheDocument(); // tooltip description

    expect(screen.getByText('isNewer')).toBeInTheDocument(); // key
    expect(screen.queryByText('\\n')).not.toBeInTheDocument(); // value
  });
});
