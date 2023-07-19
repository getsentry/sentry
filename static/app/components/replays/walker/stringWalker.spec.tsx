import {render, screen} from 'sentry-test/reactTestingLibrary';

import StringWalker from 'sentry/components/replays/walker/stringWalker';

describe('StringWalker', () => {
  it('should accept a list of strings and render a <ChevronDividedList />', () => {
    const urls = [
      'https://sourcemaps.io/',
      '/report/1655300817078_https%3A%2F%2Fmaxcdn.bootstrapcdn.com%2Fbootstrap%2F3.3.7%2Fjs%2Fbootstrap.min.js',
      '/report/1669088273097_http%3A%2F%2Funderscorejs.org%2Funderscore-min.js',
      '/report/1669088971516_https%3A%2F%2Fcdn.ravenjs.com%2F3.17.0%2Fraven.min.js',
    ];

    render(<StringWalker urls={urls} />);

    expect(screen.getByText('/')).toBeInTheDocument();
    expect(screen.getByText('2 Pages')).toBeInTheDocument();
    expect(
      screen.getByText(
        '/report/1669088971516_https%3A%2F%2Fcdn.ravenjs.com%2F3.17.0%2Fraven.min.js'
      )
    ).toBeInTheDocument();
  });
});
