import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ProblemSection} from './problemSection';

describe('ProblemSection', () => {
  it('renders title, description, and docs link', () => {
    render(<ProblemSection />);

    expect(screen.getByText('Problem')).toBeInTheDocument();
    expect(
      screen.getByText(
        "Your source maps aren't configured correctly, so stack traces will show minified code instead of your original source. Fix this to see the exact file, line, and function causing the error."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Why configure source maps?'})
    ).toHaveAttribute('href', 'https://docs.sentry.io/platforms/javascript/sourcemaps/');
  });
});
