import {copyToClipboard} from 'sentry/utils/useCopyToClipboard';

export function handleExpressiveCodeCopy(event: React.MouseEvent<HTMLElement>) {
  if (!(event.target instanceof Element)) {
    return;
  }

  const copyButton = event.target.closest<HTMLButtonElement>(
    '.expressive-code .copy button[data-code]'
  );
  if (!copyButton || !event.currentTarget.contains(copyButton)) {
    return;
  }

  const code = copyButton.dataset.code?.replaceAll('\u007F', '\n');
  if (code !== undefined) {
    void copyToClipboard(code);
  }
}
