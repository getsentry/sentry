import {render, screen} from 'sentry-test/reactTestingLibrary';

import ArchivedBox from './archivedBox';

describe('ArchivedBox', function () {
  it('handles ignoreUntil', function () {
    const {container} = render(
      <ArchivedBox statusDetails={{ignoreUntil: '2017-06-21T19:45:10Z'}} />
    );
    expect(screen.getByText(/This issue has been archived until/)).toBeInTheDocument();
    expect(container).toSnapshot();
  });
  it('handles ignoreCount', function () {
    const {container} = render(<ArchivedBox statusDetails={{ignoreUserCount: 100}} />);
    expect(
      screen.getByText(/This issue has been archived until it affects/)
    ).toBeInTheDocument();
    expect(container).toSnapshot();
  });
  it('handles ignoreCount with ignoreWindow', function () {
    const {container} = render(
      <ArchivedBox statusDetails={{ignoreCount: 100, ignoreWindow: 1}} />
    );
    expect(
      screen.getByText(/This issue has been archived until it occurs/)
    ).toBeInTheDocument();
    expect(container).toSnapshot();
  });
  it('handles ignoreUserCount', function () {
    const {container} = render(<ArchivedBox statusDetails={{ignoreUserCount: 100}} />);
    expect(
      screen.getByText(/This issue has been archived until it affects/)
    ).toBeInTheDocument();
    expect(container).toSnapshot();
  });
  it('handles ignoreUserCount with ignoreUserWindow', function () {
    const {container} = render(
      <ArchivedBox statusDetails={{ignoreUserCount: 100, ignoreUserWindow: 1}} />
    );
    expect(
      screen.getByText(/This issue has been archived until it affects/)
    ).toBeInTheDocument();
    expect(container).toSnapshot();
  });
  it('handles default', function () {
    const {container} = render(<ArchivedBox statusDetails={{}} />);
    expect(screen.getByText(/This issue has been archived/)).toBeInTheDocument();
    expect(container).toSnapshot();
  });
  it('swaps archived for archived', function () {
    render(<ArchivedBox statusDetails={{}} />, {
      organization: TestStubs.Organization({features: ['escalating-issues-ui']}),
    });
    expect(screen.getByText(/This issue has been archived/)).toBeInTheDocument();
  });
  it('handes archived until escalating', function () {
    render(<ArchivedBox statusDetails={{untilEscalating: true}} />, {
      organization: TestStubs.Organization({features: ['escalating-issues-ui']}),
    });
    expect(
      screen.getByText(/This issue has been archived until it escalates/)
    ).toBeInTheDocument();
  });
});
