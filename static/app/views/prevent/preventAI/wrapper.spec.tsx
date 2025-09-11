import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import PreventAIPageWrapper from 'sentry/views/prevent/preventAI/wrapper';
import {PREVENT_AI_PAGE_TITLE} from 'sentry/views/prevent/settings';

const COVERAGE_FEATURE = 'prevent-test-analytics';

describe('PreventAIPageWrapper', () => {
  describe('when the wrapper is used', () => {
    it('renders the document title', () => {
      render(<PreventAIPageWrapper />, {
        organization: OrganizationFixture({features: [COVERAGE_FEATURE]}),
      });

      const preventAITitle = screen.getByText(PREVENT_AI_PAGE_TITLE);
      expect(preventAITitle).toBeInTheDocument();
    });
  });
});
