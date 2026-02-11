import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import {FeatureFeedback} from 'sentry/components/featureFeedback';

describe('FeatureFeedback', () => {
  it('shows the modal on click', async () => {
    render(<FeatureFeedback featureName="test" />);
    renderGlobalModal();

    await userEvent.click(screen.getByText('Give Feedback'));

    expect(await screen.findByText('Select type of feedback')).toBeInTheDocument();

    expect(screen.getByRole('button', {name: 'Submit Feedback'})).toBeInTheDocument();
  });

  it('shows the modal on click with custom "onClick" handler', async () => {
    const mockOnClick = jest.fn();
    render(
      <FeatureFeedback
        featureName="test"
        buttonProps={{
          onClick: mockOnClick,
        }}
      />
    );
    renderGlobalModal();

    await userEvent.click(screen.getByText('Give Feedback'));

    expect(await screen.findByText('Select type of feedback')).toBeInTheDocument();

    expect(mockOnClick).toHaveBeenCalled();
  });

  it('Close modal on click', async () => {
    render(<FeatureFeedback featureName="test" />);
    const {waitForModalToHide} = renderGlobalModal();

    await userEvent.click(screen.getByText('Give Feedback'));

    await userEvent.click(await screen.findByRole('button', {name: 'Cancel'}));

    await waitForModalToHide();
  });
});
