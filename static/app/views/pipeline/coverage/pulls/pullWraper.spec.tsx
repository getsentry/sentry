import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import PullDetailWrapper from 'sentry/views/pipeline/coverage/pulls/pullWraper';

const COVERAGE_FEATURE = 'codecov-ui';

describe('CoveragePageWrapper', () => {
  describe('when the wrapper is used', () => {
    it('renders the passed children', () => {
      render(
        <PullDetailWrapper>
          <p>Test content</p>
        </PullDetailWrapper>,
        {organization: OrganizationFixture({features: [COVERAGE_FEATURE]})}
      );

      const testContent = screen.getByText('Test content');
      expect(testContent).toBeInTheDocument();
    });

    it('renders the document title', () => {
      render(
        <PullDetailWrapper>
          <p>Test content</p>
        </PullDetailWrapper>,
        {organization: OrganizationFixture({features: [COVERAGE_FEATURE]})}
      );

      const testTitle = screen.getByText('Pull Page Wrapper');
      expect(testTitle).toBeInTheDocument();
    });
  });
});
