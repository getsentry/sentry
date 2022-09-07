import {render, screen} from 'sentry-test/reactTestingLibrary';

import NoUnresolvedIssues from 'sentry/views/issueList/noGroupsHandler/noUnresolvedIssues';

describe('NoUnresolvedIssues', function () {
  it('renders', async function () {
    render(<NoUnresolvedIssues title="No issues" />);

    expect(screen.getByText('No issues')).toBeInTheDocument();
    expect(await screen.findByLabelText('Congratulations video')).toBeInTheDocument();
  });
});
