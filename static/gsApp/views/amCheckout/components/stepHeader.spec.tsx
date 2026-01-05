import {render, screen} from 'sentry-test/reactTestingLibrary';

import StepHeader from 'getsentry/views/amCheckout/components/stepHeader';

describe('StepHeader', () => {
  const mockTitle = 'Mock Title';
  const stepNumber = 1;

  it('renders for new checkout', () => {
    render(<StepHeader title={mockTitle} stepNumber={stepNumber} />);

    expect(screen.getByText(mockTitle)).toBeInTheDocument();
    expect(screen.queryByText(`${stepNumber}.`)).not.toBeInTheDocument();
    expect(screen.queryByTestId('icon-check-mark')).not.toBeInTheDocument();
    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
  });
});
