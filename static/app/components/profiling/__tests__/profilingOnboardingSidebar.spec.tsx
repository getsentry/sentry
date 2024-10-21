import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ProfilingOnboardingContent} from '../profilingOnboardingSidebar';

jest.mock('sentry/components/onboarding/gettingStartedDoc/types', () => ({
  ...jest.requireActual('sentry/components/onboarding/gettingStartedDoc/types'),
}));

const mockDocs = {
  profilingOnboarding: {
    introduction: jest.fn(() => 'Profiling Introduction'),
    install: jest.fn(() => [{title: 'Install Step', type: 'install'}]),
    configure: jest.fn(() => [{title: 'Configure Step', type: 'configure'}]),
  },
  onboarding: {
    introduction: jest.fn(() => 'Default Introduction'),
    install: jest.fn(() => [{title: 'Default Install Step', type: 'install'}]),
    configure: jest.fn(() => [{title: 'Default Configure Step', type: 'configure'}]),
  },
};

describe('ProfilingOnboardingContent', () => {
  it('renders profiling onboarding content when available', () => {
    render(
      <ProfilingOnboardingContent
        docs={mockDocs as any}
        platform="javascript"
        isSelfHosted={false}
      />
    );

    expect(screen.getByText('Profiling Introduction')).toBeInTheDocument();
    expect(screen.getByText('Install Step')).toBeInTheDocument();
    expect(screen.getByText('Configure Step')).toBeInTheDocument();
    expect(screen.queryByText('Default Introduction')).not.toBeInTheDocument();
    expect(screen.queryByText('Default Install Step')).not.toBeInTheDocument();
    expect(screen.queryByText('Default Configure Step')).not.toBeInTheDocument();
  });

  it('falls back to default onboarding content when profiling onboarding is not available', () => {
    const docsWithoutProfiling = {
      ...mockDocs,
      profilingOnboarding: undefined,
    };

    render(
      <ProfilingOnboardingContent
        docs={docsWithoutProfiling as any}
        platform="javascript"
        isSelfHosted={false}
      />
    );

    expect(screen.getByText('Default Introduction')).toBeInTheDocument();
    expect(screen.getByText('Default Install Step')).toBeInTheDocument();
    expect(screen.getByText('Default Configure Step')).toBeInTheDocument();
    expect(screen.queryByText('Profiling Introduction')).not.toBeInTheDocument();
    expect(screen.queryByText('Install Step')).not.toBeInTheDocument();
    expect(screen.queryByText('Configure Step')).not.toBeInTheDocument();
  });

  it('passes correct parameters to doc functions', () => {
    render(
      <ProfilingOnboardingContent
        docs={mockDocs as any}
        platform="javascript"
        isSelfHosted
      />
    );

    expect(mockDocs.profilingOnboarding.introduction).toHaveBeenCalledWith({
      platform: 'javascript',
      isSelfHosted: true,
    });
    expect(mockDocs.profilingOnboarding.install).toHaveBeenCalledWith({
      platform: 'javascript',
      isSelfHosted: true,
    });
  });
});
