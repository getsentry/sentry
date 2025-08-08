import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import PullsListPage from 'sentry/views/prevent/coverage/pulls';

const COVERAGE_FEATURE = 'codecov-ui';

describe('PullsListPage', () => {
  describe('when the wrapper is used', () => {
    it('renders the passed children', () => {
      render(<PullsListPage />, {
        organization: OrganizationFixture({features: [COVERAGE_FEATURE]}),
      });

      const pullsList = screen.getByText('Pulls List');
      expect(pullsList).toBeInTheDocument();
    });
  });
});
