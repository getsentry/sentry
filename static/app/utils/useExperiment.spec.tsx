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
  it('returns control group when no gsApp hook is registered', () => {
    render(<TestComponent feature="test-experiment" />);
    expect(screen.getByTestId('in-experiment')).toHaveTextContent('false');
    expect(screen.getByTestId('assignment')).toHaveTextContent('control');
  });
});
