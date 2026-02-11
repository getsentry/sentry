import {generateSentryTraceHeader} from '@sentry/core';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {HTTPSnippet} from './httpSnippet';

jest.mock('@sentry/core', () => ({
  ...jest.requireActual('@sentry/core'),
  generateSentryTraceHeader: jest.fn(() => 'sentry-trace-value'),
}));

describe('HTTPSnippet', () => {
  it('renders HTTP Request tab by default', () => {
    render(
      <HTTPSnippet
        url="https://example.com/test?query=value"
        method="POST"
        body='{"key": "value"}'
        headers={[['X-Something', 'Header Value']]}
        traceSampling={false}
      />
    );

    expect(jest.mocked(generateSentryTraceHeader)).toHaveBeenCalledWith(
      undefined,
      undefined,
      false
    );

    // Check that both tabs are present
    expect(screen.getByRole('button', {name: 'HTTP Request'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'cURL Example'})).toBeInTheDocument();

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

    const codeElem = screen.getByText(/POST \/test\?query=value HTTP\/1\.1/);

    // Using toHaveTextContent would be nice here, but it loses the newlines.
    expect(codeElem.innerHTML).toBe(expected);
  });

  it('renders cURL command when cURL tab is clicked', async () => {
    render(
      <HTTPSnippet
        url="https://example.com/test?query=value"
        method="POST"
        body='{"key": "value"}'
        headers={[['X-Something', 'Header Value']]}
        traceSampling={false}
      />
    );

    // Click on cURL tab
    await userEvent.click(screen.getByRole('button', {name: 'cURL Example'}));

    // Check that cURL command is rendered
    expect(screen.getByText(/curl -X POST/)).toBeInTheDocument();
    expect(
      screen.getByText(/https:\/\/example\.com\/test\?query=value/)
    ).toBeInTheDocument();
  });

  it('renders cURL command without body for GET request', async () => {
    render(
      <HTTPSnippet
        url="https://example.com/test"
        method="GET"
        body={null}
        headers={[]}
        traceSampling
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'cURL Example'}));

    expect(screen.getByText(/curl -X GET/)).toBeInTheDocument();
    // Should not have -d flag for GET requests without body
    expect(screen.queryByText(/-d/)).not.toBeInTheDocument();
  });
});
