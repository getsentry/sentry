import {ProjectFixture} from 'sentry-fixture/project';

import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';

import {docs} from '.';

function renderMockRequests() {
  MockApiClient.addMockResponse({
    url: '/projects/org-slug/project-slug/',
    body: [ProjectFixture()],
  });
}

describe('metrics', () => {
  it('renders metrics onboarding docs', () => {
    renderMockRequests();

    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.METRICS],
    });

    expect(
      screen.getByText(textWithMarkupMatcher(/Sentry\.metrics\.count/))
    ).toBeInTheDocument();
  });

  it('does not render metrics configuration when metrics is not enabled', () => {
    renderMockRequests();

    renderWithOnboardingLayout(docs, {
      selectedProducts: [],
    });

    expect(
      screen.queryByText(textWithMarkupMatcher(/Sentry\.metrics\.count/))
    ).not.toBeInTheDocument();
  });
});
