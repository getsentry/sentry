import {render, screen} from 'sentry-test/reactTestingLibrary';

import {CIEfficiency} from 'sentry/views/codecov/tests/summaries/ciEfficiency';

const testCIEfficiencyData = {
  slowestTests: 100,
  slowestTestsDuration: 10000,
  totalTestsRunTime: 12300000,
  totalTestsRunTimeChange: 0.46,
};

describe('CIEfficiency', () => {
  it('renders formatted total tests run time with 2 largest units', () => {
    render(<CIEfficiency {...testCIEfficiencyData} isLoading={false} />);

    const formattedTotalTestsRunTime = screen.getByText('3h 25m');
    expect(formattedTotalTestsRunTime).toBeInTheDocument();
  });
  it('renders the slowest tests duration with a filter link', () => {
    render(<CIEfficiency {...testCIEfficiencyData} isLoading={false} />);

    const formattedSlowestTests = screen.getByRole('link', {name: '10s'});
    expect(formattedSlowestTests).toBeInTheDocument();
    expect(formattedSlowestTests).toHaveAttribute(
      'href',
      '/mock-pathname/?filterBy=slowestTests'
    );
  });

  describe('rendering the total tests run time change', () => {
    describe('total tests run time is negative', () => {
      it('renders success tag', () => {
        render(
          <CIEfficiency
            {...testCIEfficiencyData}
            totalTestsRunTimeChange={-0.46}
            isLoading={false}
          />
        );

        const changeTag = screen.getByText('-0.46%');
        expect(changeTag.parentElement).toHaveAttribute('type', 'success');
      });
    });

    describe('total tests run time is positive', () => {
      it('renders error tag', () => {
        render(
          <CIEfficiency
            {...testCIEfficiencyData}
            totalTestsRunTimeChange={0.46}
            isLoading={false}
          />
        );

        const changeTag = screen.getByText('+0.46%');
        expect(changeTag.parentElement).toHaveAttribute('type', 'error');
      });
    });
  });
});
