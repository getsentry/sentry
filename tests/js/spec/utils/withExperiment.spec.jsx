import {fireEvent, render, screen} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import {logExperiment} from 'sentry/utils/analytics';
import withExperiment from 'sentry/utils/withExperiment';

jest.mock('sentry/utils/analytics', () => ({
  logExperiment: jest.fn(),
}));

jest.mock('sentry/data/experimentConfig', () => ({
  experimentConfig: {
    orgExperiment: {
      key: 'orgExperiment',
      type: 'organization',
      parameter: 'exposed',
      assignments: [1, 0, -1],
    },
    userExperiment: {
      key: 'userExperiment',
      type: 'user',
      parameter: 'exposed',
      assignments: [1, 0, -1],
    },
  },
}));

describe('withConfig HoC', function () {
  beforeEach(function () {
    jest.clearAllMocks();
  });

  const organization = {
    id: 1,
    experiments: {orgExperiment: 1},
  };

  function MyComponent(props) {
    return <span>{props.experimentAssignment}</span>;
  }
  function TriggerComponent(props) {
    return <button onClick={props.logExperiment}>click me</button>;
  }

  it('injects org experiment assignment', function () {
    const Container = withExperiment(MyComponent, {experiment: 'orgExperiment'});
    render(<Container organization={organization} />);

    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('injects user experiment assignment', function () {
    ConfigStore.set('user', {id: 123, experiments: {userExperiment: 2}});

    const Container = withExperiment(MyComponent, {experiment: 'userExperiment'});
    render(<Container />);

    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('logs experiment assignment', function () {
    const Container = withExperiment(MyComponent, {experiment: 'orgExperiment'});
    render(<Container organization={organization} />);

    expect(logExperiment).toHaveBeenCalledWith({key: 'orgExperiment', organization});
  });

  it('defers logging when injectLogExperiment is true', function () {
    const Container = withExperiment(TriggerComponent, {
      experiment: 'orgExperiment',
      injectLogExperiment: true,
    });
    render(<Container organization={organization} />);
    expect(logExperiment).not.toHaveBeenCalled();

    // Call log experiment and verify it was called
    fireEvent.click(screen.getByRole('button'));
    expect(logExperiment).toHaveBeenCalledWith({key: 'orgExperiment', organization});
  });
});
