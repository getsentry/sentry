import type * as React from 'react';

import {ClipboardFeedbackContextProvider} from '@sentry/scraps/clipboard';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';

const feedback = {
  onCopy: () => addSuccessMessage(t('Copied to clipboard')),
  onError: () => addErrorMessage(t('Error copying to clipboard')),
};

export function SentryClipboardProvider({children}: {children: React.ReactNode}) {
  return (
    <ClipboardFeedbackContextProvider value={feedback}>
      {children}
    </ClipboardFeedbackContextProvider>
  );
}
