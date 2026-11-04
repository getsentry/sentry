import {useEffect} from 'react';
import * as Sentry from '@sentry/react';

import {Button} from '@sentry/scraps/button';

interface CrashReportEmbed {
  _submitInProgress: boolean;
  onSuccess: () => void;
  submit: (body: unknown) => void;
}

/**
 * Opens the crash-report dialog without submitting a report, like the project
 * settings preview. The mock stays installed only while this button is
 * mounted, so leaving the story never swallows real crash reports.
 */
export function CrashReportPreviewButton() {
  useEffect(() => {
    const previousCallback = window.sentryEmbedCallback;

    window.sentryEmbedCallback = (embed: CrashReportEmbed) => {
      embed.submit = (_body: unknown) => {
        embed._submitInProgress = true;
        window.setTimeout(() => {
          embed._submitInProgress = false;
          embed.onSuccess();
        }, 500);
      };
    };

    return () => {
      window.sentryEmbedCallback = previousCallback;
    };
  }, []);

  return (
    <Button
      onClick={() =>
        Sentry.showReportDialog({eventId: '00000000000000000000000000000000'})
      }
    >
      Open the Crash Report Modal
    </Button>
  );
}
