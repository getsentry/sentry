import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import PullDetailPage from 'sentry/views/prevent/coverage/pulls/pullDetail';

const COVERAGE_FEATURE = 'codecov-ui';

describe('PullDetailPage', () => {
  it('renders the passed children', () => {
    render(<PullDetailPage />, {
      organization: OrganizationFixture({features: [COVERAGE_FEATURE]}),
    });

    const testContent = screen.getByText('Pull Detail Page');
    expect(testContent).toBeInTheDocument();
  });
});
