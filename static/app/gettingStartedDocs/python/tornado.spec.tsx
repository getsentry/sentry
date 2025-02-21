import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import docs from './tornado';

describe('tornado onboarding docs', function () {
  it('renders doc correctly', function () {
    renderWithOnboardingLayout(docs);

    // Renders main headings
    expect(screen.getByRole('heading', {name: 'Install'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Configure SDK'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Verify'})).toBeInTheDocument();

    // Renders install instructions
    expect(
      screen.getByText(textWithMarkupMatcher(/pip install --upgrade sentry-sdk/))
    ).toBeInTheDocument();
  });

  it('renders without tracing', function () {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [],
    });

    // Does not render config option
    expect(
      screen.queryByText(textWithMarkupMatcher(/profiles_sample_rate=1\.0,/))
    ).not.toBeInTheDocument();

    // Does not render config option
    expect(
      screen.queryByText(textWithMarkupMatcher(/traces_sample_rate=1\.0,/))
    ).not.toBeInTheDocument();
  });

  it('renders transaction profiling', function () {
    renderWithOnboardingLayout(docs);

    // Does not render continuous profiling config
    expect(
      screen.queryByText(textWithMarkupMatcher(/profile_lifecycle: "trace",/))
    ).not.toBeInTheDocument();

    // Does render transaction profiling config
    const matches = screen.getAllByText(
      textWithMarkupMatcher(/profiles_sample_rate=1\.0,/)
    );
    expect(matches.length).toBeGreaterThan(0);
    matches.forEach(match => expect(match).toBeInTheDocument());
  });

  it('renders continuous profiling', function () {
    const organization = OrganizationFixture({
      features: ['continuous-profiling'],
    });

    renderWithOnboardingLayout(
      docs,
      {},
      {
        organization,
      }
    );

    // Does not render transaction profiling config
    expect(
      screen.queryByText(textWithMarkupMatcher(/profiles_sample_rate: 1\.0,/))
    ).not.toBeInTheDocument();

    // Does render continuous profiling config
    const matches = screen.getAllByText(
      textWithMarkupMatcher(/profile_lifecycle: "trace",/)
    );
    expect(matches.length).toBeGreaterThan(0);
    matches.forEach(match => expect(match).toBeInTheDocument());
  });
});
