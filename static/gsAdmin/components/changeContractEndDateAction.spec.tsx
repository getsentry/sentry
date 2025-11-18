import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import ModalStore from 'sentry/stores/modalStore';

import ChangeContractEndDateAction from 'admin/components/changeContractEndDateAction';

describe('ChangeContractEndDateAction', () => {
  const onAction = jest.fn();
  const contractPeriodEnd = '2024-04-01';

  beforeEach(() => {
    ModalStore.reset();
    jest.clearAllMocks();
  });

  it('submits updated contract end date', async () => {
    onAction.mockResolvedValue(undefined);

    render(
      <ChangeContractEndDateAction
        contractPeriodEnd={contractPeriodEnd}
        onAction={onAction}
      />
    );
    const {waitForModalToHide} = renderGlobalModal();

    await userEvent.click(screen.getByRole('button', {name: /2024/}));

    const endDateInput = await screen.findByLabelText('End Date');
    await userEvent.click(endDateInput);
    await userEvent.keyboard('{Control>}a{/Control}');
    await userEvent.keyboard('2024-06-15');

    await userEvent.click(screen.getByRole('button', {name: 'Submit'}));

    await waitForModalToHide();

    await waitFor(() =>
      expect(onAction).toHaveBeenCalledWith({contractPeriodEnd: '2024-06-15'})
    );
  });
});
