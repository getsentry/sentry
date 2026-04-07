import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

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
  });

  it('returns inExperiment: true when assignment is active', () => {
    const org = OrganizationFixture({
      experiments: {'test-experiment': 'active'},
    });
    render(<TestComponent feature="test-experiment" reportExposure={false} />, {
      organization: org,
    });
    expect(screen.getByTestId('in-experiment')).toHaveTextContent('true');
    expect(screen.getByTestId('assignment')).toHaveTextContent('active');
  });

  it('returns inExperiment: false when assignment is control', () => {
    const org = OrganizationFixture({
      experiments: {'test-experiment': 'control'},
    });
    render(<TestComponent feature="test-experiment" reportExposure={false} />, {
      organization: org,
    });
    expect(screen.getByTestId('in-experiment')).toHaveTextContent('false');
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

  it('posts exposure on mount when reportExposure is true', async () => {
    const org = OrganizationFixture({
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

  it('does not post exposure when reportExposure is false', () => {
    const org = OrganizationFixture({
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

  // This verifies the dedupe key includes the assignment so a changed
  // assignment is treated as a distinct exposure. This scenario is unlikely in
  // practice since we don't typically reload the organization after the app
  // boots.
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
      experiments: {'test-experiment': 'active'},
    });

    render(<TestComponent feature="test-experiment" />, {
      organization: updatedOrg,
    });

    await waitFor(() => expect(mockExposure).toHaveBeenCalledTimes(2));
  });
});
