import {render, screen} from 'sentry-test/reactTestingLibrary';

import ProgressBar from 'sentry/components/progressBar';

describe('ProgressBar', function () {
  it('basic', function () {
    const progressBarValue = 50;
    render(<ProgressBar value={progressBarValue} />);

    const elementProperties = screen.getByRole('progressbar');
    // element exists
    expect(elementProperties).toBeInTheDocument();

    // check aria attributes
    expect(elementProperties).toHaveAttribute(
      'aria-valuenow',
      progressBarValue.toString()
    );
    expect(elementProperties).toHaveAttribute('aria-valuemin', '0');
    expect(elementProperties).toHaveAttribute('aria-valuemax', '100');
  });
});
