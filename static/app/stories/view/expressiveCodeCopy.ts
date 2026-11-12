import {copyToClipboard} from 'sentry/utils/useCopyToClipboard';

/**
 * Expressive Code emits an inline script to wire its generated copy buttons,
 * but scripts rendered through React do not execute. Delegate those clicks
 * from the Stories container so they use Sentry's existing clipboard behavior.
 */
export function handleExpressiveCodeCopyClick(event: React.MouseEvent<HTMLElement>) {
  if (!(event.target instanceof Element)) {
    return;
  }

  const copyButton = event.target.closest<HTMLButtonElement>(
    '.expressive-code button[data-code]'
  );
  if (!copyButton || !event.currentTarget.contains(copyButton)) {
    return;
  }

  const code = copyButton.dataset.code?.replaceAll('\u007F', '\n');
  if (code !== undefined && navigator.clipboard) {
    copyToClipboard(code).catch(() => {});
  }
}
