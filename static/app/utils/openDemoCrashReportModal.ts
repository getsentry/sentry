import * as Sentry from '@sentry/react';

// The SPA DSN only accepts sentry.io origins, so crash report previews break on
// demo.dev.getsentry.net. Use the internal feedback project DSN for demo modals.
export const DEMO_CRASH_REPORT_MODAL_DSN =
  'https://3c5ef4e344a04a0694d187a1272e96de@o1.ingest.sentry.io/6356259';

const DEMO_CRASH_REPORT_MODAL_EVENT_ID = '00000000000000000000000000000000';

export function openDemoCrashReportModal() {
  Sentry.showReportDialog({
    dsn: DEMO_CRASH_REPORT_MODAL_DSN,
    // This should never make it to Sentry, but keep the demo detached from real events.
    eventId: DEMO_CRASH_REPORT_MODAL_EVENT_ID,
  });
}
