import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import CommitsPageWrapper from 'sentry/views/pipeline/coverage/commits/commitWrapper';

const COVERAGE_FEATURE = 'codecov-ui';

describe('CoveragePageWrapper', () => {
  describe('when the wrapper is used', () => {
    it('renders the passed children', () => {
      render(
        <CommitsPageWrapper>
          <p>Test content</p>
        </CommitsPageWrapper>,
        {organization: OrganizationFixture({features: [COVERAGE_FEATURE]})}
      );

      const testContent = screen.getByText('Test content');
      expect(testContent).toBeInTheDocument();
    });

    it('renders the document title', () => {
      render(
        <CommitsPageWrapper>
          <p>Test content</p>
        </CommitsPageWrapper>,
        {organization: OrganizationFixture({features: [COVERAGE_FEATURE]})}
      );

      const testTitle = screen.getByText('Commit Page Wrapper');
      expect(testTitle).toBeInTheDocument();
    });
  });
});
