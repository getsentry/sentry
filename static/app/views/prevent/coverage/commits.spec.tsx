import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import CommitsListPage from 'sentry/views/prevent/coverage/commits';

const COVERAGE_FEATURE = 'codecov-ui';

describe('CommitsListPage', () => {
  describe('when the wrapper is used', () => {
    it('renders the passed children', () => {
      render(<CommitsListPage />, {
        organization: OrganizationFixture({features: [COVERAGE_FEATURE]}),
      });

      const commitsList = screen.getByText('Commits List');
      expect(commitsList).toBeInTheDocument();
    });
  });
});
