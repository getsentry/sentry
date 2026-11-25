import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {docs} from '.';

const profilingDocs = {...docs, onboarding: docs.profilingOnboarding!};

describe('python profiling onboarding docs', () => {
  it('renders continuous profiling config', () => {
    const organization = OrganizationFixture({features: ['continuous-profiling']});

    renderWithOnboardingLayout(profilingDocs, {}, {organization});

    expect(
      screen.getByText(textWithMarkupMatcher(/profile_session_sample_rate=1\.0/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/sentry_sdk\.profiler\.start_profiler\(\)/))
    ).toBeInTheDocument();
    expect(
      screen.queryByText(textWithMarkupMatcher(/only available on sentry-sdk 2\.x/))
    ).not.toBeInTheDocument();
  });

  it('renders no profiling config without the continuous-profiling feature', () => {
    renderWithOnboardingLayout(profilingDocs);

    expect(
      screen.getByText(textWithMarkupMatcher(/traces_sample_rate=1\.0/))
    ).toBeInTheDocument();
    expect(
      screen.queryByText(textWithMarkupMatcher(/profiles_sample_rate=/))
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(textWithMarkupMatcher(/profile_session_sample_rate=/))
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(textWithMarkupMatcher(/start_profiler/))
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/only available on sentry-sdk 2\.x/))
    ).toBeInTheDocument();
  });
});
