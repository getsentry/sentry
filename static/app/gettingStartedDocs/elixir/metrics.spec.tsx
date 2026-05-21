import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';

import {docs} from '.';

describe('metrics', () => {
  it('elixir metrics onboarding docs', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.METRICS],
    });

    expect(
      screen.getByText(textWithMarkupMatcher(/Sentry\.Metrics\.count/))
    ).toBeInTheDocument();
  });

  it('does not render metrics configuration when metrics is not enabled', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [],
    });

    expect(
      screen.queryByText(textWithMarkupMatcher(/Sentry\.Metrics\.count/))
    ).not.toBeInTheDocument();
  });
});
