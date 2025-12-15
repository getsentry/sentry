import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import StepHeader from 'getsentry/views/amCheckout/components/stepHeader';

describe('StepHeader', () => {
  let onEdit: any;

  const mockTitle = 'Mock Title';
  const stepNumber = 1;

  beforeEach(() => {
    onEdit = jest.fn();
  });

  it('renders active', () => {
    render(
      <StepHeader
        isActive
        title={mockTitle}
        stepNumber={stepNumber}
        onEdit={onEdit}
        isCompleted={false}
      />
    );

    expect(screen.getByText(`${stepNumber}.`)).toBeInTheDocument();
    expect(screen.getByText(mockTitle)).toBeInTheDocument();
    expect(screen.queryByTestId('icon-check-mark')).not.toBeInTheDocument();
    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Expand section')).not.toBeInTheDocument();
  });

  it('renders complete', async () => {
    render(
      <StepHeader
        isCompleted
        title={mockTitle}
        stepNumber={stepNumber}
        onEdit={onEdit}
        isActive={false}
      />
    );

    expect(screen.queryByText(`${stepNumber}.`)).not.toBeInTheDocument();
    expect(screen.getByText(mockTitle)).toBeInTheDocument();
    expect(screen.getByTestId('icon-check-mark')).toBeInTheDocument();
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByLabelText('Expand section')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Edit'));
    expect(onEdit).toHaveBeenCalled();
  });

  it('renders not active, not complete, and can skip to step', async () => {
    render(
      <StepHeader
        canSkip
        title={mockTitle}
        stepNumber={stepNumber}
        onEdit={onEdit}
        isActive={false}
        isCompleted={false}
      />
    );

    expect(screen.getByText(mockTitle)).toBeInTheDocument();
    expect(screen.queryByTestId('icon-check-mark')).not.toBeInTheDocument();

    await userEvent.click(screen.getByText(mockTitle));
    expect(onEdit).toHaveBeenCalled();
  });

  it('renders not active, not complete, and cannot skip to step', async () => {
    render(
      <StepHeader
        title={mockTitle}
        stepNumber={stepNumber}
        onEdit={onEdit}
        isActive={false}
        isCompleted={false}
      />
    );
    expect(screen.getByText(mockTitle)).toBeInTheDocument();
    expect(screen.queryByTestId('icon-check-mark')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Expand section')).not.toBeInTheDocument();

    expect(onEdit).not.toHaveBeenCalled();
    await userEvent.click(screen.getByText(mockTitle));
  });

  it('renders for new checkout', () => {
    render(
      <StepHeader
        isNewCheckout
        title={mockTitle}
        stepNumber={stepNumber}
        onEdit={onEdit}
        isActive={false}
        isCompleted={false}
        isOpen={false}
      />
    );

    expect(screen.getByText(mockTitle)).toBeInTheDocument();
    expect(screen.queryByText(`${stepNumber}.`)).not.toBeInTheDocument();
    expect(screen.queryByTestId('icon-check-mark')).not.toBeInTheDocument();
    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
  });
});
