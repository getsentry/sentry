import * as Amplitude from '@amplitude/analytics-browser';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';

import {_resetExposureTracking, useExperiment} from 'getsentry/hooks/useExperiment';

function TestComponent({
  feature,
  reportExposure,
}: {
  feature: string;
  reportExposure?: boolean;
}) {
  const {inExperiment, experimentAssignment} = useExperiment({
    feature,
    reportExposure,
  });
  return (
    <div>
      <span data-test-id="in-experiment">{String(inExperiment)}</span>
      <span data-test-id="assignment">{experimentAssignment}</span>
    </div>
  );
}

describe('useExperiment (gsApp)', () => {
  beforeEach(() => {
    _resetExposureTracking();
    ConfigStore.set('enableAnalytics', true);
  });

  it('returns inExperiment: true when feature is enabled', () => {
    const org = OrganizationFixture({
      features: ['test-experiment'],
      experiments: {'test-experiment': 'active'},
    });
    render(<TestComponent feature="test-experiment" reportExposure={false} />, {
      organization: org,
    });
    expect(screen.getByTestId('in-experiment')).toHaveTextContent('true');
    expect(screen.getByTestId('assignment')).toHaveTextContent('active');
  });

  it('returns inExperiment: false when feature is not enabled', () => {
    const org = OrganizationFixture({
      experiments: {'test-experiment': 'control'},
    });
    render(<TestComponent feature="test-experiment" reportExposure={false} />, {
      organization: org,
    });
    expect(screen.getByTestId('in-experiment')).toHaveTextContent('false');
    expect(screen.getByTestId('assignment')).toHaveTextContent('control');
  });

  it('returns inExperiment: true with feature flag even without experiments entry', () => {
    const org = OrganizationFixture({
      features: ['test-experiment'],
    });
    render(<TestComponent feature="test-experiment" reportExposure={false} />, {
      organization: org,
    });
    expect(screen.getByTestId('in-experiment')).toHaveTextContent('true');
    expect(screen.getByTestId('assignment')).toHaveTextContent('control');
  });

  it('returns control when experiment is not present', () => {
    const org = OrganizationFixture({experiments: {}});
    render(<TestComponent feature="missing-experiment" reportExposure={false} />, {
      organization: org,
    });
    expect(screen.getByTestId('in-experiment')).toHaveTextContent('false');
    expect(screen.getByTestId('assignment')).toHaveTextContent('control');
  });

  it('posts exposure on mount when reportExposure is true and experiments entry exists', async () => {
    const org = OrganizationFixture({
      features: ['test-experiment'],
      experiments: {'test-experiment': 'active'},
    });
    const mockExposure = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/experiment-exposure/`,
      method: 'POST',
      statusCode: 204,
    });

    render(<TestComponent feature="test-experiment" />, {organization: org});

    await waitFor(() => {
      expect(mockExposure).toHaveBeenCalledWith(
        `/organizations/${org.slug}/experiment-exposure/`,
        expect.objectContaining({
          method: 'POST',
          data: {experimentName: 'test-experiment', assignment: 'active'},
        })
      );
    });
  });

  it('sets the Amplitude experiment group property on exposure', async () => {
    const org = OrganizationFixture({
      features: ['onboarding-scm-experiment'],
      experiments: {'onboarding-scm-experiment': 'active'},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/experiment-exposure/`,
      method: 'POST',
      statusCode: 204,
    });

    render(<TestComponent feature="onboarding-scm-experiment" />, {organization: org});

    await waitFor(() => expect(Amplitude.groupIdentify).toHaveBeenCalled());

    // The property name and value live on the Identify instance's .set call;
    // groupIdentify just routes that instance to the right group. Asserting
    // both together verifies the full wiring and the hyphen-to-underscore
    // transform matches getsentry/experiments/tasks.py.
    const identifyInstance = jest.mocked(Amplitude.Identify).mock.results[0]!.value;
    expect(identifyInstance.set).toHaveBeenCalledWith(
      'experiment_onboarding_scm_experiment',
      'active'
    );
    expect(Amplitude.groupIdentify).toHaveBeenCalledWith(
      'organization_id',
      org.id,
      identifyInstance
    );
  });

  it('does not set the Amplitude group property when reportExposure is false', () => {
    const org = OrganizationFixture({
      features: ['test-experiment'],
      experiments: {'test-experiment': 'active'},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/experiment-exposure/`,
      method: 'POST',
      statusCode: 204,
    });

    render(<TestComponent feature="test-experiment" reportExposure={false} />, {
      organization: org,
    });

    expect(Amplitude.groupIdentify).not.toHaveBeenCalled();
  });

  it('does not set the Amplitude group property when analytics are disabled', () => {
    ConfigStore.set('enableAnalytics', false);
    const org = OrganizationFixture({
      features: ['test-experiment'],
      experiments: {'test-experiment': 'active'},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/experiment-exposure/`,
      method: 'POST',
      statusCode: 204,
    });

    render(<TestComponent feature="test-experiment" />, {organization: org});

    expect(Amplitude.groupIdentify).not.toHaveBeenCalled();
  });

  it('does not report exposure when the feature has no experiment assignment', () => {
    // Feature is enabled via organization.features (e.g. SENTRY_FEATURES or a
    // regular non-experiment flag) but has no entry in organization.experiments.
    // The BE only fires auto-exposure for flags with experiment_mode set, so we
    // match that behavior here and skip both the Amplitude write and the POST.
    const org = OrganizationFixture({
      features: ['not-an-experiment'],
      experiments: {},
    });
    const mockExposure = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/experiment-exposure/`,
      method: 'POST',
      statusCode: 204,
    });

    render(<TestComponent feature="not-an-experiment" />, {organization: org});

    expect(Amplitude.groupIdentify).not.toHaveBeenCalled();
    expect(mockExposure).not.toHaveBeenCalled();
    // The hook still returns a sensible default for consumers.
    expect(screen.getByTestId('in-experiment')).toHaveTextContent('true');
    expect(screen.getByTestId('assignment')).toHaveTextContent('control');
  });

  it('does not post exposure when reportExposure is false', () => {
    const org = OrganizationFixture({
      features: ['test-experiment'],
      experiments: {'test-experiment': 'active'},
    });
    const mockExposure = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/experiment-exposure/`,
      method: 'POST',
      statusCode: 204,
    });

    render(<TestComponent feature="test-experiment" reportExposure={false} />, {
      organization: org,
    });

    expect(mockExposure).not.toHaveBeenCalled();
  });

  it('reports exposure when reportExposure changes from false to true', async () => {
    const org = OrganizationFixture({
      features: ['test-experiment'],
      experiments: {'test-experiment': 'active'},
    });
    const mockExposure = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/experiment-exposure/`,
      method: 'POST',
      statusCode: 204,
    });

    const {rerender} = render(
      <TestComponent feature="test-experiment" reportExposure={false} />,
      {organization: org}
    );

    expect(mockExposure).not.toHaveBeenCalled();

    rerender(<TestComponent feature="test-experiment" reportExposure />);

    await waitFor(() => expect(mockExposure).toHaveBeenCalledTimes(1));
  });

  it('deduplicates exposure reports across remounts', async () => {
    const org = OrganizationFixture({
      features: ['test-experiment'],
      experiments: {'test-experiment': 'active'},
    });
    const mockExposure = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/experiment-exposure/`,
      method: 'POST',
      statusCode: 204,
    });

    const {unmount} = render(<TestComponent feature="test-experiment" />, {
      organization: org,
    });

    await waitFor(() => {
      expect(mockExposure).toHaveBeenCalledTimes(1);
    });

    unmount();

    render(<TestComponent feature="test-experiment" />, {organization: org});

    expect(mockExposure).toHaveBeenCalledTimes(1);
  });

  it('re-reports exposure when assignment changes', async () => {
    const org = OrganizationFixture({
      experiments: {'test-experiment': 'control'},
    });
    const mockExposure = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/experiment-exposure/`,
      method: 'POST',
      statusCode: 204,
    });

    const {unmount} = render(<TestComponent feature="test-experiment" />, {
      organization: org,
    });

    await waitFor(() => expect(mockExposure).toHaveBeenCalledTimes(1));

    unmount();

    const updatedOrg = OrganizationFixture({
      features: ['test-experiment'],
      experiments: {'test-experiment': 'active'},
    });

    render(<TestComponent feature="test-experiment" />, {
      organization: updatedOrg,
    });

    await waitFor(() => expect(mockExposure).toHaveBeenCalledTimes(2));
  });
});
