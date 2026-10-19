import * as Sentry from '@sentry/react';

export function showCrashReportPreview() {
  const previousCallback = window.sentryEmbedCallback;

  // Match the project settings preview without submitting a report.
  window.sentryEmbedCallback = embed => {
    embed.submit = function (_body: unknown) {
      this._submitInProgress = true;
      window.setTimeout(() => {
        this._submitInProgress = false;
        this.onSuccess();
      }, 500);
    };
  };

  const restoreCallback = () => {
    window.sentryEmbedCallback = previousCallback;
  };

  Sentry.showReportDialog({
    eventId: '00000000000000000000000000000000',
    onClose: restoreCallback,
    onError: restoreCallback,
  });
}
