import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import docs from '.';

describe('flutter onboarding docs', () => {
  it('renders docs correctly', async () => {
    renderWithOnboardingLayout(docs, {
      releaseRegistry: {
        'sentry.dart.flutter': {
          version: '1.99.9',
        },
      },
    });

    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          /Add Sentry automatically to your app with the Sentry wizard/
        )
      )
    ).toBeInTheDocument();

    expect(
      screen.getByRole('heading', {name: /automatic configuration/i})
    ).toBeInTheDocument();

    expect(
      screen.getByRole('heading', {name: /manual configuration/i})
    ).toBeInTheDocument();

    expect(screen.getByRole('heading', {name: 'Verify'})).toBeInTheDocument();

    expect(screen.getByRole('link', {name: 'Structured Logs'})).toBeInTheDocument();
  });
});
