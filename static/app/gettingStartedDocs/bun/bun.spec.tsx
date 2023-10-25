import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import docs from './bun';

describe('bun onboarding docs', function () {
  it('renders doc correctly', function () {
    renderWithOnboardingLayout(docs);

    // Renders main headings
    expect(screen.getByRole('heading', {name: 'Install'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Configure SDK'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Verify'})).toBeInTheDocument();

    // Renders config options
    expect(
      screen.getByText(textWithMarkupMatcher(/tracesSampleRate: 1\.0,/))
    ).toBeInTheDocument();
  });

  it('renders without performance monitoring', function () {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [],
    });

    // Does not render config option
    expect(
      screen.queryByText(textWithMarkupMatcher(/tracesSampleRate: 1\.0,/))
    ).not.toBeInTheDocument();

    // Renders next steps
    expect(
      screen.getByRole('link', {name: 'Performance Monitoring'})
    ).toBeInTheDocument();
  });
});
