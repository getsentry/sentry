import {
  CopyToClipboardButton as ClipboardButton,
  type CopyToClipboardButtonProps,
} from '@sentry/scraps/clipboard';

import {SentryClipboardProvider} from 'sentry/scrapsProviders/clipboard';

/** Keep application notification feedback for existing callers. */
export function CopyToClipboardButton(props: CopyToClipboardButtonProps) {
  return (
    <SentryClipboardProvider>
      <ClipboardButton {...props} />
    </SentryClipboardProvider>
  );
}
