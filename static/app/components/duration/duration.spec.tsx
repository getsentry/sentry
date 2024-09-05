import {render, screen} from 'sentry-test/reactTestingLibrary';

import Duration from 'sentry/components/duration/duration';

describe('Duration', () => {
  it('should render the duration in the default format', () => {
    render(<Duration duration={[83, 'sec']} precision="sec" />);

    const time = screen.getByText('01:23');
    expect(time).toBeInTheDocument();
  });

  it('should render the duration in the specified format', () => {
    render(<Duration duration={[83_456, 'ms']} precision="ms" format="h:mm:ss.sss" />);

    const time = screen.getByText('1:23.456');
    expect(time).toBeInTheDocument();
  });

  it('should include `dateTime` & `title` attributes for accessibility', () => {
    // See https://developer.mozilla.org/en-US/docs/Web/HTML/Element/time

    render(<Duration duration={[83, 'sec']} precision="sec" />);

    const time = screen.getByText('01:23');
    expect(time).toHaveAttribute('datetime', 'PT1M23S');
    expect(time).toHaveAttribute('title', '01:23.000');
  });
});
