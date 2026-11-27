import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ChangeARRAction} from 'admin/components/changeARRAction';

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

    const input = screen.getByRole('spinbutton', {name: 'ARR'});
    expect(input).toHaveValue(10000);

    await userEvent.clear(input);
    await userEvent.type(input, '15000');
    await userEvent.click(screen.getByRole('button', {name: 'Submit'}));

    await waitFor(() => expect(onAction).toHaveBeenCalledWith({customPrice: 1500000}));
  });

  it('disables submit for a negative ARR', async () => {
    render(<ChangeARRAction customer={{acv: 1000000}} onAction={onAction} />);

    await userEvent.click(screen.getByRole('button'));
    renderGlobalModal();

    const input = screen.getByRole('spinbutton', {name: 'ARR'});
    await userEvent.clear(input);
    await userEvent.type(input, '-5');

    expect(screen.getByRole('button', {name: 'Submit'})).toBeDisabled();
  });
});
