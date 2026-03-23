import {ProjectFixture} from 'sentry-fixture/project';

import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';

import docs from '.';

function renderMockRequests() {
  MockApiClient.addMockResponse({
    url: '/projects/org-slug/project-slug/',
    body: [ProjectFixture()],
  });
}

describe('metrics', () => {
  it('unity metrics onboarding docs', () => {
    renderMockRequests();

    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.METRICS],
    });

    expect(
      screen.getByText(textWithMarkupMatcher(/SentrySdk\.Metrics\.Increment/))
    ).toBeInTheDocument();
  });

  it('does not render metrics configuration when metrics is not enabled', () => {
    renderMockRequests();

    renderWithOnboardingLayout(docs, {
      selectedProducts: [],
    });

    expect(
      screen.queryByText(textWithMarkupMatcher(/SentrySdk\.Metrics\.Increment/))
    ).not.toBeInTheDocument();
  });
});
