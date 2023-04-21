import {render, screen} from 'sentry-test/reactTestingLibrary';

import MutedBox from 'sentry/components/mutedBox';

describe('MutedBox', function () {
  it('handles ignoreUntil', function () {
    const {container} = render(
      <MutedBox statusDetails={{ignoreUntil: '2017-06-21T19:45:10Z'}} />
    );
    expect(screen.getByText(/This issue has been ignored until/)).toBeInTheDocument();
    expect(container).toSnapshot();
  });
  it('handles ignoreCount', function () {
    const {container} = render(<MutedBox statusDetails={{ignoreUserCount: 100}} />);
    expect(
      screen.getByText(/This issue has been ignored until it affects/)
    ).toBeInTheDocument();
    expect(container).toSnapshot();
  });
  it('handles ignoreCount with ignoreWindow', function () {
    const {container} = render(
      <MutedBox statusDetails={{ignoreCount: 100, ignoreWindow: 1}} />
    );
    expect(
      screen.getByText(/This issue has been ignored until it occurs/)
    ).toBeInTheDocument();
    expect(container).toSnapshot();
  });
  it('handles ignoreUserCount', function () {
    const {container} = render(<MutedBox statusDetails={{ignoreUserCount: 100}} />);
    expect(
      screen.getByText(/This issue has been ignored until it affects/)
    ).toBeInTheDocument();
    expect(container).toSnapshot();
  });
  it('handles ignoreUserCount with ignoreUserWindow', function () {
    const {container} = render(
      <MutedBox statusDetails={{ignoreUserCount: 100, ignoreUserWindow: 1}} />
    );
    expect(
      screen.getByText(/This issue has been ignored until it affects/)
    ).toBeInTheDocument();
    expect(container).toSnapshot();
  });
  it('handles default', function () {
    const {container} = render(<MutedBox statusDetails={{}} />);
    expect(screen.getByText(/This issue has been ignored/)).toBeInTheDocument();
    expect(container).toSnapshot();
  });
});
