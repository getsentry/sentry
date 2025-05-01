import {render, screen} from 'sentry-test/reactTestingLibrary';

import {Summaries} from 'sentry/views/codecov/tests/summaries/summaries';

describe('Summaries', () => {
  it('renders the CIEfficiency component', () => {
    render(<Summaries />);

    const ciEfficiencyPanel = screen.getByText('CI Efficiency');
    expect(ciEfficiencyPanel).toBeInTheDocument();
  });
});
