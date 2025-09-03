import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import CommitHistoryPage from 'sentry/views/prevent/coverage/commits/commitHistory';

const COVERAGE_FEATURE = 'codecov-ui';

describe('CommitHistoryPage', () => {
  it('renders the passed children', () => {
    render(<CommitHistoryPage />, {
      organization: OrganizationFixture({features: [COVERAGE_FEATURE]}),
    });

    const testContent = screen.getByText('Commit History Page');
    expect(testContent).toBeInTheDocument();
  });
});
