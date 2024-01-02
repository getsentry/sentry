import {Organization} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import withExperiment from 'sentry/utils/withExperiment';

describe('withConfig HoC', function () {
  beforeEach(function () {
    jest.clearAllMocks();
  });

  function MyComponent(props) {
    return <span>{props.experimentAssignment}</span>;
  }

  it('injects experiment assignment', function () {
    const Container = withExperiment(MyComponent, {
      // @ts-expect-error This is a test experiment that does not exist, it
      // will evalulate to -1 assignment
      experiment: 'orgExperiment',
    });
    render(<Container organization={Organization()} />);

    expect(screen.getByText('-1')).toBeInTheDocument();
  });
});
