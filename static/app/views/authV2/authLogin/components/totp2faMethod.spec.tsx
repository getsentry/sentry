import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {mockElementFromPoint} from './testUtils';
import {Totp2FAMethod} from './totp2faMethod';

describe('Totp2FAMethod', () => {
  mockElementFromPoint();

  it('submits a six-digit authentication code', async () => {
    const onSubmit = jest.fn();
    render(<Totp2FAMethod isProcessing={false} onSubmit={onSubmit} resetKey={null} />);

    await userEvent.type(
      screen.getByRole('textbox', {name: 'One-time password'}),
      '123456'
    );

    expect(onSubmit).toHaveBeenCalledWith('123456');
  });
});
