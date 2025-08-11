import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import CommitDetailWrapper from 'sentry/views/prevent/coverage/commits/commitWrapper';

const COVERAGE_FEATURE = 'codecov-ui';

describe('CommitDetailWrapper', () => {
  describe('when the wrapper is used', () => {
    it('renders the document title', () => {
      render(<CommitDetailWrapper />, {
        organization: OrganizationFixture({features: [COVERAGE_FEATURE]}),
      });

      const testTitle = screen.getByText('Commit Page Wrapper');
      expect(testTitle).toBeInTheDocument();
    });
  });
});
