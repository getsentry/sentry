import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {TESTS_PAGE_TITLE} from 'sentry/views/pipeline/settings';
import TestAnalyticsPageWrapper from 'sentry/views/pipeline/tests';

const COVERAGE_FEATURE = 'codecov-ui';

describe('TestAnalyticsPageWrapper', () => {
  describe('when the wrapper is used', () => {
    it('renders the passed children', () => {
      render(
        <TestAnalyticsPageWrapper>
          <p>Test content</p>
        </TestAnalyticsPageWrapper>,
        {organization: OrganizationFixture({features: [COVERAGE_FEATURE]})}
      );

      const testContent = screen.getByText('Test content');
      expect(testContent).toBeInTheDocument();
    });

    it('renders the document title', () => {
      render(
        <TestAnalyticsPageWrapper>
          <p>Test content</p>
        </TestAnalyticsPageWrapper>,
        {organization: OrganizationFixture({features: [COVERAGE_FEATURE]})}
      );

      const testTitle = screen.getByText(TESTS_PAGE_TITLE);
      expect(testTitle).toBeInTheDocument();
    });
  });
});
