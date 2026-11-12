import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Recovery2FAMethod} from './recovery2faMethod';
import {mockElementFromPoint} from './testUtils';

describe('Recovery2FAMethod', () => {
  mockElementFromPoint();

  it('submits an uppercase recovery code', async () => {
    const onSubmit = jest.fn();
    render(
      <Recovery2FAMethod isProcessing={false} onSubmit={onSubmit} resetKey={null} />
    );

    await userEvent.type(
      screen.getByRole('textbox', {name: 'One-time password'}),
      'abcd1234'
    );

    expect(onSubmit).toHaveBeenCalledWith('ABCD1234');
  });
});
