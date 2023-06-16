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
    const Container = withExperiment(MyComponent, {experiment: 'orgExperiment'});
    render(<Container />);

    expect(screen.getByText('-1')).toBeInTheDocument();
  });
});
