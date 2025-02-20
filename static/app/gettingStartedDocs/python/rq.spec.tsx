import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import docs from './rq';

describe('rq onboarding docs', function () {
  it('renders doc correctly', function () {
    renderWithOnboardingLayout(docs);

    // Renders main headings
    expect(screen.getByRole('heading', {name: 'Install'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Configure SDK'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Verify'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Job definition'})).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {name: 'Settings for worker'})
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Main Python Script'})).toBeInTheDocument();

    // Renders install instructions
    expect(
      screen.getByText(textWithMarkupMatcher(/pip install --upgrade 'sentry-sdk\[rq\]'/))
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
      screen.queryByText(
        textWithMarkupMatcher(/sentry_sdk.profiler.start_profile_session\(\)/)
      )
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        textWithMarkupMatcher(/sentry_sdk.profiler.stop_profile_session\(\)/)
      )
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
      screen.queryByText(textWithMarkupMatcher(/profiles_sample_rate=1\.0,/))
    ).not.toBeInTheDocument();

    // Does render continuous profiling config
    const startMatches = screen.queryAllByText(
      textWithMarkupMatcher(/sentry_sdk.profiler.start_profile_session\(\)/)
    );
    expect(startMatches.length).toBeGreaterThan(0);
    startMatches.forEach(match => expect(match).toBeInTheDocument());

    const stopMatches = screen.queryAllByText(
      textWithMarkupMatcher(/sentry_sdk.profiler.stop_profile_session\(\)/)
    );
    expect(stopMatches.length).toBeGreaterThan(0);
    stopMatches.forEach(match => expect(match).toBeInTheDocument());
  });
});
