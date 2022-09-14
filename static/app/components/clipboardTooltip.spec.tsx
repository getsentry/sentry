import copy from 'copy-text-to-clipboard';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ClipboardTooltip from 'sentry/components/clipboardTooltip';

jest.mock('copy-text-to-clipboard');

describe('ClipboardTooltip', function () {
  it('renders', async function () {
    const title = 'tooltip content';
    const content = 'This text displays a tooltip when hovering';
    render(
      <ClipboardTooltip title={title}>
        <span>{content}</span>
      </ClipboardTooltip>
    );

    expect(screen.getByText(content)).toBeInTheDocument();
    userEvent.hover(screen.getByText(content));

    await screen.findByText(title);

    expect(screen.getByLabelText('Copy to clipboard')).toBeInTheDocument();
    userEvent.click(screen.getByLabelText('Copy to clipboard'), undefined, {
      skipPointerEventsCheck: true,
    });

    expect(copy).toHaveBeenCalledWith(title);
  });
});
