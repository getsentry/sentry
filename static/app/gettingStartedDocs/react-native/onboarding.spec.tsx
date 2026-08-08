import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {docs} from '.';

describe('getting started with react-native', () => {
  it('renders docs correctly', async () => {
    renderWithOnboardingLayout(docs);

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
      screen.getByRole('heading', {name: /configurable features/i})
    ).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Logs'})).toHaveAttribute(
      'href',
      'https://docs.sentry.io/platforms/react-native/logs/'
    );
    expect(screen.getByRole('link', {name: 'Size Analysis'})).toHaveAttribute(
      'href',
      'https://docs.sentry.io/platforms/react-native/size-analysis/'
    );

    expect(
      screen.getByRole('heading', {name: /manual configuration/i})
    ).toBeInTheDocument();
  });
});
