import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ExceptionDescription} from 'sentry/components/stackTrace/exceptionHeader';

describe('ExceptionDescription', () => {
  it('renders colored text and links without escape codes when given an ANSI value', () => {
    const value = '\x1B[31mfailed\x1B[0m to fetch https://example.com/status';

    const {container} = render(<ExceptionDescription mechanism={null} value={value} />);

    expect(container).toHaveTextContent(
      /^failed to fetch https:\/\/example\.com\/status$/
    );
    expect(screen.getByText('failed').style.color).toContain('color-mix(in srgb,');
    expect(screen.getByText('https://example.com/status').tagName).toBe('A');
  });
});
