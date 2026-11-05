import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {CopyToClipboardButton} from '@sentry/scraps/clipboard';
import {toast} from '@sentry/scraps/toast';

beforeEach(() => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {writeText: jest.fn().mockResolvedValue(undefined)},
  });
});

it('preserves application success feedback and the caller callback', async () => {
  const success = jest.spyOn(toast, 'success');
  const onCopy = jest.fn();
  render(<CopyToClipboardButton aria-label="Copy" text="message" onCopy={onCopy} />);

  await userEvent.click(screen.getByRole('button', {name: 'Copy'}));

  expect(success).toHaveBeenCalledWith('Copied to clipboard');
  expect(onCopy).toHaveBeenCalledWith('message');
});

it('preserves application failure feedback', async () => {
  const error = jest.spyOn(toast, 'error');
  jest.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('Denied'));
  const onCopy = jest.fn();
  render(<CopyToClipboardButton aria-label="Copy" text="message" onCopy={onCopy} />);

  await userEvent.click(screen.getByRole('button', {name: 'Copy'}));

  expect(error).toHaveBeenCalledWith('Error copying to clipboard');
  expect(onCopy).not.toHaveBeenCalled();
});
