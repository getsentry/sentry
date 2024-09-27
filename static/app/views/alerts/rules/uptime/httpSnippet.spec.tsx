import {render} from 'sentry-test/reactTestingLibrary';

import {HTTPSnippet} from './httpSnippet';

jest.mock('@sentry/utils', () => ({
  ...jest.requireActual('@sentry/utils'),
  generateSentryTraceHeader: jest.fn(() => 'sentry-trace-value'),
}));

describe('HTTPSnippet', function () {
  it('renders', function () {
    const {container} = render(
      <HTTPSnippet
        url="https://example.com/test?query=value"
        method="POST"
        body={'{"key": "value"}'}
        headers={[['X-Something', 'Header Value']]}
      />
    );

    const expected = [
      'POST /test?query=value HTTP/1.1',
      'Host: example.com',
      'X-Something: Header Value',
      'Sentry-Trace: sentry-trace-value',
      'Content-Size: 18',
      ``,
      `{"key": "value"}`,
    ].join('\r\n');

    // XXX(epurkhiser): Using toHaveTextContent would be nice here, but it
    // loses the newlines.
    expect(container.getElementsByTagName('code')[0].innerHTML).toBe(expected);
  });
});
