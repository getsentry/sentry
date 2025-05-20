import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import ChangeContractEndDateAction from 'admin/components/changeContractEndDateAction';

describe('ChangeContractEndDateAction', function () {
  const onAction = jest.fn();

  it('renders empty', function () {
    render(
      <ChangeContractEndDateAction contractPeriodEnd="2020-01-04" onAction={onAction} />
    );
  });

  it('renders default end date value', async function () {
    render(
      <ChangeContractEndDateAction contractPeriodEnd="2020-01-04" onAction={onAction} />
    );

    await userEvent.click(screen.getByRole('button'));
    renderGlobalModal();

    expect(screen.getByLabelText('End Date')).toHaveValue('2020-01-04');
  });
});
