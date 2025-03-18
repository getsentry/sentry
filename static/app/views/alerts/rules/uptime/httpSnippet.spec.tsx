import {generateSentryTraceHeader} from '@sentry/core';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {HTTPSnippet} from './httpSnippet';

vi.mock('@sentry/core', async () => {
  const actual = await vi.importActual('@sentry/core');
  return {
    ...actual,
    generateSentryTraceHeader: vi.fn(() => 'sentry-trace-value'),
  };
});

describe('HTTPSnippet', function () {
  it('renders', function () {
    render(
      <HTTPSnippet
        url="https://example.com/test?query=value"
        method="POST"
        body={'{"key": "value"}'}
        headers={[['X-Something', 'Header Value']]}
        traceSampling={false}
      />
    );

    expect(vi.mocked(generateSentryTraceHeader)).toHaveBeenCalledWith(
      undefined,
      undefined,
      false
    );

    const expected = [
      'POST /test?query=value HTTP/1.1',
      'Host: example.com',
      'X-Something: Header Value',
      'User-Agent: SentryUptimeBot/1.0 (+http://docs.sentry.io/product/alerts/uptime-monitoring/)',
      'Sentry-Trace: sentry-trace-value',
      'Content-Size: 18',
      ``,
      `{"key": "value"}`,
    ].join('\r\n');

    const codeElem = screen.getByText('POST /test?query=value HTTP/1.1', {exact: false});

    // Using toHaveTextContent would be nice here, but it loses the newlines.
    expect(codeElem.innerHTML).toBe(expected);
  });
});
