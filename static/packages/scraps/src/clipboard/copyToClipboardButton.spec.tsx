import type * as React from 'react';
import {ThemeProvider} from '@emotion/react';
import {render, screen, waitFor} from '@testing-library/react';
import {userEvent} from '@testing-library/user-event';

import {lightTheme} from '@sentry/scraps/theme';
import {toast} from '@sentry/scraps/toast';

import {CopyToClipboardButton} from './index';

function ThemeWrapper({children}: {children: React.ReactNode}) {
  return <ThemeProvider theme={lightTheme}>{children}</ThemeProvider>;
}

describe('CopyToClipboardButton', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('copies with keyboard activation and reports success without an app adapter', async () => {
    const user = userEvent.setup();
    const onCopy = jest.fn();
    const onClick = jest.fn();
    const writeText = jest.spyOn(navigator.clipboard, 'writeText');
    const success = jest.spyOn(toast, 'success');
    render(
      <CopyToClipboardButton
        aria-label="Copy message"
        text="message"
        onCopy={onCopy}
        onClick={onClick}
      />,
      {wrapper: ThemeWrapper}
    );
    await user.tab();
    await user.keyboard('{Enter}');
    expect(writeText).toHaveBeenCalledWith('message');
    expect(onCopy).toHaveBeenCalledWith('message');
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(success).toHaveBeenCalledWith('Copied to clipboard');
  });

  it('waits for the write before showing feedback or reporting success', async () => {
    const user = userEvent.setup();
    let finish: () => void = () => {};
    jest.spyOn(navigator.clipboard, 'writeText').mockImplementation(
      () =>
        new Promise<void>(resolve => {
          finish = resolve;
        })
    );
    const onCopy = jest.fn();
    const success = jest.spyOn(toast, 'success');
    render(<CopyToClipboardButton aria-label="Copy" text="message" onCopy={onCopy} />, {
      wrapper: ThemeWrapper,
    });
    await user.click(screen.getByRole('button', {name: 'Copy'}));
    expect(onCopy).not.toHaveBeenCalled();
    expect(success).not.toHaveBeenCalled();
    finish();
    await waitFor(() => expect(onCopy).toHaveBeenCalledWith('message'));
    expect(success).toHaveBeenCalledWith('Copied to clipboard');
  });

  it('reports a rejected write with failure feedback and no success callback', async () => {
    const user = userEvent.setup();
    const error = new Error('Permission denied');
    jest.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(error);
    const onCopy = jest.fn();
    const onError = jest.fn();
    const success = jest.spyOn(toast, 'success');
    const failure = jest.spyOn(toast, 'error');
    render(
      <CopyToClipboardButton
        aria-label="Copy"
        text="message"
        onCopy={onCopy}
        onError={onError}
      />,
      {wrapper: ThemeWrapper}
    );
    await user.click(screen.getByRole('button', {name: 'Copy'}));
    expect(onError).toHaveBeenCalledWith(error);
    expect(failure).toHaveBeenCalledWith('Error copying to clipboard');
    expect(onCopy).not.toHaveBeenCalled();
    expect(success).not.toHaveBeenCalled();
  });

  it('handles an unavailable clipboard API', async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', {configurable: true, value: undefined});
    const onError = jest.fn();
    const failure = jest.spyOn(toast, 'error');
    render(<CopyToClipboardButton aria-label="Copy" text="message" onError={onError} />, {
      wrapper: ThemeWrapper,
    });
    await user.click(screen.getByRole('button', {name: 'Copy'}));
    expect(onError).toHaveBeenCalledWith(expect.any(TypeError));
    expect(failure).toHaveBeenCalledWith('Error copying to clipboard');
  });

  it.each([false, true])(
    'does not write or notify when disabled (tooltip: %s)',
    async tooltip => {
      const user = userEvent.setup();
      const writeText = jest.spyOn(navigator.clipboard, 'writeText');
      const success = jest.spyOn(toast, 'success');
      render(
        <CopyToClipboardButton
          aria-label="Copy"
          text="message"
          disabled
          tooltipProps={tooltip ? {title: 'Unavailable'} : undefined}
        />,
        {wrapper: ThemeWrapper}
      );
      await user.click(screen.getByRole('button', {name: 'Copy'}));
      expect(writeText).not.toHaveBeenCalled();
      expect(success).not.toHaveBeenCalled();
    }
  );

  it('uses per-instance success feedback', async () => {
    const user = userEvent.setup();
    const success = jest.spyOn(toast, 'success');
    render(
      <CopyToClipboardButton
        aria-label="Copy"
        text="message"
        successMessage="Message copied"
      />,
      {wrapper: ThemeWrapper}
    );
    await user.click(screen.getByRole('button', {name: 'Copy'}));
    expect(success).toHaveBeenCalledWith('Message copied');
  });

  it('supports disabling success and failure feedback per instance', async () => {
    const user = userEvent.setup();
    const writeText = jest.spyOn(navigator.clipboard, 'writeText');
    const success = jest.spyOn(toast, 'success');
    const failure = jest.spyOn(toast, 'error');
    const {rerender} = render(
      <CopyToClipboardButton aria-label="Copy" text="message" successMessage={false} />,
      {wrapper: ThemeWrapper}
    );
    await user.click(screen.getByRole('button', {name: 'Copy'}));
    expect(success).not.toHaveBeenCalled();
    writeText.mockRejectedValue(new Error('Denied'));
    rerender(
      <CopyToClipboardButton aria-label="Copy" text="message" errorMessage={false} />
    );
    await user.click(screen.getByRole('button', {name: 'Copy'}));
    expect(failure).not.toHaveBeenCalled();
  });
});
