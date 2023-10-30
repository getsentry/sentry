import {render, screen} from 'sentry-test/reactTestingLibrary';

import MutedBox from 'sentry/components/mutedBox';

describe('MutedBox', function () {
  it('handles ignoreUntil', function () {
    render(<MutedBox statusDetails={{ignoreUntil: '2017-06-21T19:45:10Z'}} />);
    expect(screen.getByText(/This issue has been ignored until/)).toBeInTheDocument();
  });
  it('handles ignoreCount', function () {
    render(<MutedBox statusDetails={{ignoreUserCount: 100}} />);
    expect(
      screen.getByText(/This issue has been ignored until it affects/)
    ).toBeInTheDocument();
  });
  it('handles ignoreCount with ignoreWindow', function () {
    render(<MutedBox statusDetails={{ignoreCount: 100, ignoreWindow: 1}} />);
    expect(
      screen.getByText(/This issue has been ignored until it occurs/)
    ).toBeInTheDocument();
  });
  it('handles ignoreUserCount', function () {
    render(<MutedBox statusDetails={{ignoreUserCount: 100}} />);
    expect(
      screen.getByText(/This issue has been ignored until it affects/)
    ).toBeInTheDocument();
  });
  it('handles ignoreUserCount with ignoreUserWindow', function () {
    render(<MutedBox statusDetails={{ignoreUserCount: 100, ignoreUserWindow: 1}} />);
    expect(
      screen.getByText(/This issue has been ignored until it affects/)
    ).toBeInTheDocument();
  });
  it('handles default', function () {
    render(<MutedBox statusDetails={{}} />);
    expect(screen.getByText(/This issue has been ignored/)).toBeInTheDocument();
  });
});
