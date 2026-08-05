import {copyToClipboard} from 'sentry/utils/useCopyToClipboard';

describe('copyToClipboard', () => {
  const clipboard = navigator.clipboard;
  const execCommand = document.execCommand;

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: clipboard,
    });
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: execCommand,
    });
  });

  it('falls back when the Clipboard API is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    });
    const mockExecCommand = jest.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: mockExecCommand,
    });

    await expect(copyToClipboard('Scraps', null)).resolves.toBe('Scraps');

    expect(mockExecCommand).toHaveBeenCalledWith('copy');
    expect(document.querySelector('textarea')).not.toBeInTheDocument();
  });

  it('falls back when the Clipboard API rejects the write', async () => {
    const writeText = jest
      .fn()
      .mockRejectedValueOnce(
        new DOMException('Write permission denied', 'NotAllowedError')
      );
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {writeText},
    });
    const mockExecCommand = jest.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: mockExecCommand,
    });

    await expect(copyToClipboard('Scraps', null)).resolves.toBe('Scraps');

    expect(mockExecCommand).toHaveBeenCalledWith('copy');
  });

  it('rejects when the fallback cannot copy', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: jest.fn().mockReturnValue(false),
    });

    await expect(copyToClipboard('Scraps', null)).rejects.toThrow(
      'Unable to copy to clipboard'
    );
  });
});
