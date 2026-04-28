import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {useExperiment} from 'sentry/utils/useExperiment';

function TestComponent({feature}: {feature: string}) {
  const {inExperiment, experimentAssignment} = useExperiment({feature});
  return (
    <div>
      <span data-test-id="in-experiment">{String(inExperiment)}</span>
      <span data-test-id="assignment">{experimentAssignment}</span>
    </div>
  );
}

describe('useExperiment (open-source fallback)', () => {
  it('returns control group when feature is not enabled', () => {
    render(<TestComponent feature="test-experiment" />);
    expect(screen.getByTestId('in-experiment')).toHaveTextContent('false');
    expect(screen.getByTestId('assignment')).toHaveTextContent('control');
  });

  it('returns inExperiment true when feature is enabled', () => {
    const org = OrganizationFixture({features: ['test-experiment']});
    render(<TestComponent feature="test-experiment" />, {organization: org});
    expect(screen.getByTestId('in-experiment')).toHaveTextContent('true');
    expect(screen.getByTestId('assignment')).toHaveTextContent('control');
  });
});
