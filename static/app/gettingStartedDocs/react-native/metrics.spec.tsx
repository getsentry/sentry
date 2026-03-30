import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';

import {docs} from '.';

describe('getting started with react-native', () => {
  it('shows React Native metrics onboarding content', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.METRICS],
    });

    expect(
      screen.getByText(textWithMarkupMatcher(/Sentry\.metrics\.count/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/Sentry\.metrics\.gauge/))
    ).toBeInTheDocument();
  });

  it('does not render metrics content when metrics is not enabled', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [],
    });

    expect(
      screen.queryByText(textWithMarkupMatcher(/Sentry\.metrics\.count/))
    ).not.toBeInTheDocument();
  });
});
