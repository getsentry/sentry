import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import CoveragePageWrapper from 'sentry/views/pipeline/coverage';
import {COVERAGE_PAGE_TITLE} from 'sentry/views/pipeline/settings';

const COVERAGE_FEATURE = 'codecov-ui';

describe('CoveragePageWrapper', () => {
  describe('when the wrapper is used', () => {
    it('renders the passed children', () => {
      render(
        <CoveragePageWrapper>
          <p>Test content</p>
        </CoveragePageWrapper>,
        {organization: OrganizationFixture({features: [COVERAGE_FEATURE]})}
      );

      const testContent = screen.getByText('Test content');
      expect(testContent).toBeInTheDocument();
    });

    it('renders the document title', () => {
      render(
        <CoveragePageWrapper>
          <p>Test content</p>
        </CoveragePageWrapper>,
        {organization: OrganizationFixture({features: [COVERAGE_FEATURE]})}
      );

      const testTitle = screen.getByText(COVERAGE_PAGE_TITLE);
      expect(testTitle).toBeInTheDocument();
    });
  });
});
