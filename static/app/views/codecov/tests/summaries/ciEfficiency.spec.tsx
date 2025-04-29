import {render, screen} from 'sentry-test/reactTestingLibrary';

import {CIEfficiency} from 'sentry/views/codecov/tests/summaries/ciEfficiency';

const testCIEfficiencyData = {
  slowestTests: 100,
  slowestTestsDuration: 10000,
  totalTestsRunTime: 12300000,
  totalTestsRunTimeChange: 0.46,
};

describe('CIEfficiency', () => {
  it('renders formatted total tests run time', () => {
    render(<CIEfficiency {...testCIEfficiencyData} />);

    const formattedTotalTestsRunTime = screen.getByText('3h 25m 0s');
    expect(formattedTotalTestsRunTime).toBeInTheDocument();
  });

  it('renders the slowest tests with a filter link', () => {
    render(<CIEfficiency {...testCIEfficiencyData} />);

    const formattedSlowestTests = screen.getByRole('link', {name: '100'});
    expect(formattedSlowestTests).toBeInTheDocument();
    expect(formattedSlowestTests).toHaveAttribute(
      'href',
      '/mock-pathname/?f_b_type=slowest_tests'
    );
  });

  describe('rendering the total tests run time change', () => {
    describe('total tests run time is negative', () => {
      it('renders success tag', () => {
        render(
          <CIEfficiency {...testCIEfficiencyData} totalTestsRunTimeChange={-0.46} />
        );

        const changeTag = screen.getByText('-0.46%');
        expect(changeTag.parentElement).toHaveAttribute('type', 'success');
      });
    });

    describe('total tests run time is positive', () => {
      it('renders error tag', () => {
        render(<CIEfficiency {...testCIEfficiencyData} totalTestsRunTimeChange={0.46} />);

        const changeTag = screen.getByText('+0.46%');
        expect(changeTag.parentElement).toHaveAttribute('type', 'error');
      });
    });
  });
});
