import {render, screen} from 'sentry-test/reactTestingLibrary';

import ArchivedBox from './archivedBox';

describe('ArchivedBox', function () {
  it('handles ignoreUntil', function () {
    render(<ArchivedBox statusDetails={{ignoreUntil: '2017-06-21T19:45:10Z'}} />);
    expect(screen.getByText(/This issue has been archived until/)).toBeInTheDocument();
  });
  it('handles ignoreCount', function () {
    render(<ArchivedBox statusDetails={{ignoreUserCount: 100}} />);
    expect(
      screen.getByText(/This issue has been archived until it affects/)
    ).toBeInTheDocument();
  });
  it('handles ignoreCount with ignoreWindow', function () {
    render(<ArchivedBox statusDetails={{ignoreCount: 100, ignoreWindow: 1}} />);
    expect(
      screen.getByText(/This issue has been archived until it occurs/)
    ).toBeInTheDocument();
  });
  it('handles ignoreUserCount', function () {
    render(<ArchivedBox statusDetails={{ignoreUserCount: 100}} />);
    expect(
      screen.getByText(/This issue has been archived until it affects/)
    ).toBeInTheDocument();
  });
  it('handles ignoreUserCount with ignoreUserWindow', function () {
    render(<ArchivedBox statusDetails={{ignoreUserCount: 100, ignoreUserWindow: 1}} />);
    expect(
      screen.getByText(/This issue has been archived until it affects/)
    ).toBeInTheDocument();
  });
  it('handles archived forever', function () {
    render(<ArchivedBox statusDetails={{}} />);
    expect(screen.getByText(/This issue has been archived forever/)).toBeInTheDocument();
  });
  it('handes archived until escalating', function () {
    render(<ArchivedBox statusDetails={{ignoreUntilEscalating: true}} />, {
      organization: TestStubs.Organization({features: ['escalating-issues-ui']}),
    });
    expect(
      screen.getByText(
        /This issue has been archived\. It'll return to your inbox if it escalates/
      )
    ).toBeInTheDocument();
  });
});
