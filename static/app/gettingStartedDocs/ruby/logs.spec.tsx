import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';

import {logs} from './logs';

describe('ruby logs onboarding docs', () => {
  it('does not need an option to enable logs', async () => {
    renderWithOnboardingLayout(
      {onboarding: logs({docsPlatform: 'ruby'})},
      {selectedProducts: [ProductSolution.LOGS]}
    );

    expect(
      await screen.findByText(
        textWithMarkupMatcher(/config\.enabled_patches = \[:logger\]/)
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByText(textWithMarkupMatcher(/enable_logs/))
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(textWithMarkupMatcher(/structured_logging/))
    ).not.toBeInTheDocument();
  });

  it('enables Rails structured logging for Rails', async () => {
    renderWithOnboardingLayout(
      {onboarding: logs({docsPlatform: 'rails'})},
      {selectedProducts: [ProductSolution.LOGS]}
    );

    expect(
      await screen.findByText(
        textWithMarkupMatcher(/config\.rails\.structured_logging\.enabled = true/)
      )
    ).toBeInTheDocument();
  });
});
