import {render, screen} from 'sentry-test/reactTestingLibrary';

import NoUnresolvedIssues from 'sentry/views/issueList/noGroupsHandler/noUnresolvedIssues';

describe('NoUnresolvedIssues', function () {
  it('renders', function () {
    render(<NoUnresolvedIssues title="No issues" subtitle="Go make some issues!" />);

    expect(screen.getByText('No issues')).toBeInTheDocument();
    expect(screen.getByText('Go make some issues!')).toBeInTheDocument();
    expect(screen.getByAltText('No issues found spot illustration')).toBeInTheDocument();
  });
});
