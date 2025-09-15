import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import PullDetailWrapper from 'sentry/views/prevent/coverage/pulls/pullWrapper';

const COVERAGE_FEATURE = 'codecov-ui';

describe('PullDetailWrapper', () => {
  describe('when the wrapper is used', () => {
    it('renders the document title', () => {
      render(<PullDetailWrapper />, {
        organization: OrganizationFixture({features: [COVERAGE_FEATURE]}),
      });

      const testTitle = screen.getByText('Pull Page Wrapper');
      expect(testTitle).toBeInTheDocument();
    });
  });
});
