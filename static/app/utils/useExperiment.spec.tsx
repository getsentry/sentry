import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {OrganizationFeature} from 'sentry/types/featureFlags.generated';

import {useExperiment} from './useExperiment';

function TestComponent({feature}: {feature: OrganizationFeature}) {
  const {inExperiment, experimentAssignment} = useExperiment({
    feature,
    reportExposure: false,
  });
  return (
    <div>
      <span data-test-id="in-experiment">{String(inExperiment)}</span>
      <span data-test-id="assignment">{experimentAssignment}</span>
    </div>
  );
}

describe('useExperiment (open-source fallback)', () => {
  it('returns control group when feature is not enabled', () => {
    render(<TestComponent feature="investigations" />);
    expect(screen.getByTestId('in-experiment')).toHaveTextContent('false');
    expect(screen.getByTestId('assignment')).toHaveTextContent('control');
  });

  it('returns inExperiment true when feature is enabled', () => {
    const org = OrganizationFixture({features: ['investigations']});
    render(<TestComponent feature="investigations" />, {
      organization: org,
    });
    expect(screen.getByTestId('in-experiment')).toHaveTextContent('true');
    expect(screen.getByTestId('assignment')).toHaveTextContent('control');
  });
});
