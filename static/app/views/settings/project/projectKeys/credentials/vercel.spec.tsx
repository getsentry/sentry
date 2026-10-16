import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {VercelTab} from 'sentry/views/settings/project/projectKeys/credentials/vercel';

describe('VercelTab', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {writeText: jest.fn().mockResolvedValue(undefined)},
    });
  });

  it.each([
    {
      label: 'Vercel Log Drain Endpoint',
      value: 'https://example.com/vercel/logs',
      hint: 'Use this endpoint to configure Vercel Log Drains. Learn more',
    },
    {
      label: 'Log Drain Authentication Headers',
      value: 'x-sentry-auth: sentry sentry_key=public-key',
      hint: 'Set these authentication headers when configuring your Vercel Log Drain.',
    },
    {
      label: 'Vercel Trace Drain Endpoint',
      value: 'https://example.com/traces/',
      hint: 'Set this URL as your Vercel Trace Drain Endpoint (OTLP format). Learn more',
    },
    {
      label: 'Vercel Trace Drain Authentication Headers',
      value: 'x-sentry-auth: sentry sentry_key=public-key',
      hint: 'Set these security headers when configuring your Vercel Trace Drain.',
    },
  ])('labels, selects, and copies the read-only $label', async ({label, value, hint}) => {
    render(
      <VercelTab
        integrationEndpoint="https://example.com/"
        publicKey="public-key"
        tracesEndpoint="https://example.com/traces/"
      />
    );

    const input = screen.getByRole<HTMLInputElement>('textbox', {name: label});
    expect(screen.getByLabelText(label)).toBe(input);
    expect(input).toHaveAccessibleDescription(hint);
    expect(input).toHaveValue(value);
    expect(input).toHaveAttribute('readonly');

    await userEvent.click(input);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(value.length);

    await userEvent.keyboard('changed');
    expect(input).toHaveValue(value);

    await userEvent.tab();
    expect(document.activeElement).toHaveAccessibleName('Copy to clipboard');
    await userEvent.keyboard('{Enter}');
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(value);
  });
});
