import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {CopyAsDropdown} from 'sentry/components/copyAsDropdown';

jest.mock('sentry/actionCreators/indicator');

describe('CopyAsDropdown', () => {
  const writeText = jest.fn();

  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {writeText},
    });
  });

  it('shows one success message after copying', async () => {
    writeText.mockResolvedValue(undefined);
    render(
      <CopyAsDropdown
        items={CopyAsDropdown.makeDefaultCopyAsOptions({
          markdown: () => '# Markdown',
          text: undefined,
          json: undefined,
        })}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Copy as'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Markdown'}));

    expect(writeText).toHaveBeenCalledWith('# Markdown');
    await waitFor(() => expect(addSuccessMessage).toHaveBeenCalledTimes(1));
    expect(addErrorMessage).not.toHaveBeenCalled();
  });

  it('does not show a success message when copying fails', async () => {
    writeText.mockRejectedValue(new DOMException('Copy failed', 'NotAllowedError'));
    render(
      <CopyAsDropdown
        items={CopyAsDropdown.makeDefaultCopyAsOptions({
          markdown: () => '# Markdown',
          text: undefined,
          json: undefined,
        })}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Copy as'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Markdown'}));

    await waitFor(() => expect(addErrorMessage).toHaveBeenCalledTimes(1));
    expect(addSuccessMessage).not.toHaveBeenCalled();
  });
});
