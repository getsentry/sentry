import type * as React from 'react';
import {ThemeProvider} from '@emotion/react';
import {render, screen, waitFor} from '@testing-library/react';
import {userEvent} from '@testing-library/user-event';

import {lightTheme} from '@sentry/scraps/theme';

import {ClipboardFeedbackContextProvider, CopyToClipboardButton} from './index';

function ThemeWrapper({children}: {children: React.ReactNode}) {
  return <ThemeProvider theme={lightTheme}>{children}</ThemeProvider>;
}

describe('CopyToClipboardButton', () => {
  it('copies with keyboard activation without an application provider', async () => {
    const user = userEvent.setup();
    const onCopy = jest.fn();
    const onClick = jest.fn();
    const writeText = jest.spyOn(navigator.clipboard, 'writeText');
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
  });

  it('waits for a successful write before reporting success', async () => {
    const user = userEvent.setup();
    let finish: () => void = () => {};
    jest.spyOn(navigator.clipboard, 'writeText').mockImplementation(
      () =>
        new Promise<void>(resolve => {
          finish = resolve;
        })
    );
    const onCopy = jest.fn();
    const feedback = {onCopy: jest.fn(), onError: jest.fn()};
    render(
      <ClipboardFeedbackContextProvider value={feedback}>
        <CopyToClipboardButton aria-label="Copy" text="message" onCopy={onCopy} />
      </ClipboardFeedbackContextProvider>,
      {wrapper: ThemeWrapper}
    );

    await user.click(screen.getByRole('button', {name: 'Copy'}));
    expect(onCopy).not.toHaveBeenCalled();
    expect(feedback.onCopy).not.toHaveBeenCalled();
    finish();
    await waitFor(() => expect(onCopy).toHaveBeenCalledWith('message'));
    expect(feedback.onCopy).toHaveBeenCalledWith('message');
    expect(feedback.onError).not.toHaveBeenCalled();
  });

  it('reports a failed write without calling success handlers', async () => {
    const user = userEvent.setup();
    const error = new Error('Permission denied');
    jest.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(error);
    const onCopy = jest.fn();
    const onError = jest.fn();
    const feedback = {onCopy: jest.fn(), onError: jest.fn()};
    render(
      <ClipboardFeedbackContextProvider value={feedback}>
        <CopyToClipboardButton
          aria-label="Copy"
          text="message"
          onCopy={onCopy}
          onError={onError}
        />
      </ClipboardFeedbackContextProvider>,
      {wrapper: ThemeWrapper}
    );

    await user.click(screen.getByRole('button', {name: 'Copy'}));
    expect(onError).toHaveBeenCalledWith(error);
    expect(feedback.onError).toHaveBeenCalledWith(error);
    expect(onCopy).not.toHaveBeenCalled();
    expect(feedback.onCopy).not.toHaveBeenCalled();
  });

  it('handles an unavailable clipboard API', async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', {configurable: true, value: undefined});
    const onError = jest.fn();
    render(<CopyToClipboardButton aria-label="Copy" text="message" onError={onError} />, {
      wrapper: ThemeWrapper,
    });

    await user.click(screen.getByRole('button', {name: 'Copy'}));
    expect(onError).toHaveBeenCalledWith(expect.any(TypeError));
  });

  it.each([false, true])('does not copy when disabled (tooltip: %s)', async tooltip => {
    const user = userEvent.setup();
    const writeText = jest.spyOn(navigator.clipboard, 'writeText');
    const onCopy = jest.fn();
    render(
      <CopyToClipboardButton
        aria-label="Copy"
        text="message"
        disabled
        onCopy={onCopy}
        tooltipProps={tooltip ? {title: 'Unavailable'} : undefined}
      />,
      {wrapper: ThemeWrapper}
    );

    await user.click(screen.getByRole('button', {name: 'Copy'}));
    expect(writeText).not.toHaveBeenCalled();
    expect(onCopy).not.toHaveBeenCalled();
  });
});
