import {DataScrubbingRelayPiiConfigFixture} from 'sentry-fixture/dataScrubbingRelayPiiConfig';
import {EventFixture} from 'sentry-fixture/event';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {EventExtraData} from 'sentry/components/events/eventExtraData';

describe('EventExtraData', () => {
  it('preserves empty strings and other falsy values in the formatted view', () => {
    render(
      <EventExtraData
        event={EventFixture({
          context: {sha: '', missing: null, count: 0, enabled: false, foo: 'bar'},
        })}
      />
    );

    expect(screen.getByText('sha')).toBeInTheDocument();
    expect(screen.getByText('missing')).toBeInTheDocument();
    expect(screen.getByText('null')).toBeInTheDocument();
    expect(screen.getByText('count')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('enabled')).toBeInTheDocument();
    expect(screen.getByText('false')).toBeInTheDocument();
    expect(screen.getByText('foo')).toBeInTheDocument();
    expect(screen.getByText('bar')).toBeInTheDocument();
  });

  it('preserves empty strings and other falsy values in the raw view', async () => {
    render(
      <EventExtraData
        event={EventFixture({
          context: {sha: '', missing: null, count: 0, enabled: false, foo: 'bar'},
        })}
      />
    );

    await userEvent.click(screen.getByRole('radio', {name: 'Raw'}));

    expect(screen.getByText('sha')).toBeInTheDocument();
    expect(screen.getByText('missing')).toBeInTheDocument();
    expect(screen.getByText('null')).toBeInTheDocument();
    expect(screen.getByText('count')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('enabled')).toBeInTheDocument();
    expect(screen.getByText('false')).toBeInTheDocument();
    expect(screen.getByText('foo')).toBeInTheDocument();
    expect(screen.getByText('bar')).toBeInTheDocument();
  });

  it('preserves the label for known extra data', () => {
    render(
      <EventExtraData event={EventFixture({context: {crashed_process: 'worker'}})} />
    );

    expect(screen.getByText('Crashed Process')).toBeInTheDocument();
    expect(screen.getByText('worker')).toBeInTheDocument();
  });

  it('renders a scrubbed null value as redacted', () => {
    render(
      <EventExtraData
        event={EventFixture({
          context: {secret: null},
          _meta: {context: {secret: {'': {rem: [['project:0', 'x']]}}}},
        })}
      />
    );

    expect(screen.getByText('secret')).toBeInTheDocument();
    expect(screen.getByText('<redacted>')).toBeInTheDocument();
    expect(screen.queryByText('null')).not.toBeInTheDocument();
  });

  it('display redacted data', async () => {
    const event = EventFixture({
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
                rem: [['organization:2', 's', 0, 0]],
                len: 49,
                chunks: [
                  {
                    type: 'redaction',
                    text: '',
                    rule_id: 'organization:2',
                    remark: 's',
                  },
                ],
              },
            },
            '1': {
              '': {
                rem: [['organization:2', 's', 0, 0]],
                len: 17,
                chunks: [
                  {
                    type: 'redaction',
                    text: '',
                    rule_id: 'organization:2',
                    remark: 's',
                  },
                ],
              },
            },
            '2': {
              '': {
                rem: [['organization:2', 's', 0, 0]],
                len: 12,
                chunks: [
                  {
                    type: 'redaction',
                    text: '',
                    rule_id: 'organization:2',
                    remark: 's',
                  },
                ],
              },
            },
            '3': {
              '': {
                rem: [['organization:2', 's', 0, 0]],
                len: 8,
                chunks: [
                  {
                    type: 'redaction',
                    text: '',
                    rule_id: 'organization:2',
                    remark: 's',
                  },
                ],
              },
            },
            '4': {
              '': {
                rem: [['organization:2', 's', 0, 0]],
                len: 30,
                chunks: [
                  {
                    type: 'redaction',
                    text: '',
                    rule_id: 'organization:2',
                    remark: 's',
                  },
                ],
              },
            },
            '5': {
              '': {
                rem: [['organization:2', 's', 0, 0]],
                len: 8,
                chunks: [
                  {
                    type: 'redaction',
                    text: '',
                    rule_id: 'organization:2',
                    remark: 's',
                  },
                ],
              },
            },
            '6': {
              '': {
                rem: [['organization:2', 's', 0, 0]],
                len: 18,
                chunks: [
                  {
                    type: 'redaction',
                    text: '',
                    rule_id: 'organization:2',
                    remark: 's',
                  },
                ],
              },
            },
            '7': {
              '': {
                rem: [['organization:2', 's', 0, 0]],
                len: 8,
                chunks: [
                  {
                    type: 'redaction',
                    text: '',
                    rule_id: 'organization:2',
                    remark: 's',
                  },
                ],
              },
            },
            '8': {
              '': {
                rem: [['organization:2', 's', 0, 0]],
                len: 26,
                chunks: [
                  {
                    type: 'redaction',
                    text: '',
                    rule_id: 'organization:2',
                    remark: 's',
                  },
                ],
              },
            },
            '9': {
              '': {
                rem: [['organization:2', 's', 0, 0]],
                len: 8,
                chunks: [
                  {
                    type: 'redaction',
                    text: '',
                    rule_id: 'organization:2',
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
    });

    render(<EventExtraData event={event} />, {
      organization: {
        relayPiiConfig: JSON.stringify(DataScrubbingRelayPiiConfigFixture()),
      },
    });

    // Before expanding, number of items is 14 because 4 items are redacted
    expect(screen.getByText(/14 items/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Expand'}));
    expect(await screen.findAllByText(/redacted/)).toHaveLength(10);

    // After expanding, indicate that some items were truncated
    expect(screen.getByText(/\(4 items truncated\)/)).toBeInTheDocument();

    await userEvent.hover(screen.getAllByText(/redacted/)[0]!);

    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          "Replaced because of the data scrubbing rule [Replace] [[a-zA-Z0-9]+] with [Placeholder] from [$message] in your organization's settings"
        )
      )
    ).toBeInTheDocument(); // tooltip description

    expect(screen.getByText('isNewer')).toBeInTheDocument(); // key
    expect(screen.queryByText('\\n')).not.toBeInTheDocument(); // value
  });

  it('renders values as raw JSON when the raw view is selected', async () => {
    render(<EventExtraData event={EventFixture({context: {foo: {bar: 'baz'}}})} />);

    await userEvent.click(screen.getByRole('radio', {name: 'Raw'}));

    expect(screen.getByText('{"bar":"baz"}')).toBeInTheDocument();
  });
});
