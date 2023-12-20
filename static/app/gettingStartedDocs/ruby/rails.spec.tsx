import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import docs from './rails';

describe('rails onboarding docs', function () {
  it('renders doc correctly', function () {
    renderWithOnboardingLayout(docs);

    // Renders main headings
    expect(screen.getByRole('heading', {name: 'Install'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Configure SDK'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Caveats'})).toBeInTheDocument();

    // Renders config options
    expect(
      screen.getByText(textWithMarkupMatcher(/config.breadcrumbs_logger/))
    ).toBeInTheDocument();

    // Renders import
    expect(
      screen.getByText(textWithMarkupMatcher(/gem \"sentry-ruby\"/))
    ).toBeInTheDocument();
  });
});
