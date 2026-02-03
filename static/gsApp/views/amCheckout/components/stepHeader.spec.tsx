import {render, screen} from 'sentry-test/reactTestingLibrary';

import StepHeader from 'getsentry/views/amCheckout/components/stepHeader';

describe('StepHeader', () => {
  const mockTitle = 'Mock Title';

  it('renders for checkout', () => {
    render(<StepHeader title={mockTitle} />);

    expect(screen.getByText(mockTitle)).toBeInTheDocument();
    expect(screen.queryByTestId('icon-check-mark')).not.toBeInTheDocument();
    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
  });
});
