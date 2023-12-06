import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import docs from './wpf';

describe('wpf onboarding docs', function () {
  it('renders docs correctly', async function () {
    renderWithOnboardingLayout(docs, {
      releaseRegistry: {
        'sentry.dotnet': {
          version: '1.99.9',
        },
      },
    });

    // Renders main headings
    expect(screen.getByRole('heading', {name: 'Install'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Configure SDK'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Verify'})).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {name: 'Performance Monitoring'})
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Documentation'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Samples'})).toBeInTheDocument();

    // Renders SDK version from registry
    expect(
      await screen.findByText(
        textWithMarkupMatcher(/Install-Package Sentry -Version 1\.99\.9/)
      )
    ).toBeInTheDocument();
  });
});
