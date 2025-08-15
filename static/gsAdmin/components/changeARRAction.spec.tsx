import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import ChangeARRAction from 'admin/components/changeARRAction';

describe('ChangeARRAction', () => {
  const onAction = jest.fn();

  it('renders empty', () => {
    render(<ChangeARRAction customer={{}} onAction={onAction} />);
  });

  it('renders default ACV value', async () => {
    render(<ChangeARRAction customer={{acv: 1000000}} onAction={onAction} />);

    await userEvent.click(screen.getByRole('button'));
    renderGlobalModal();

    expect(
      screen.getByText(
        textWithMarkupMatcher('Their new annual contract value will be $10,000')
      )
    ).toBeInTheDocument();
  });

  it('can change ACV value', async () => {
    render(<ChangeARRAction customer={{acv: 1000000}} onAction={onAction} />);

    await userEvent.click(screen.getByRole('button'));
    renderGlobalModal();

    await userEvent.type(screen.getByRole('spinbutton', {name: 'ARR'}), '15000');
    await userEvent.click(screen.getByRole('button', {name: 'Submit'}));

    expect(onAction).toHaveBeenCalledWith({customPrice: 1500000});
  });
});
