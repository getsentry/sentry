import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import CommitDetailPage from 'sentry/views/prevent/coverage/commits/commitDetail';

const COVERAGE_FEATURE = 'codecov-ui';

describe('CommitDetailPage', () => {
  it('renders the placeholder content', () => {
    render(<CommitDetailPage />, {
      organization: OrganizationFixture({features: [COVERAGE_FEATURE]}),
    });

    const testContent = screen.getByText('Commit Detail Page');
    expect(testContent).toBeInTheDocument();
  });
});
