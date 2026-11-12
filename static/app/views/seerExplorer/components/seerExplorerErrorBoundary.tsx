import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {t} from 'sentry/locale';

/**
 * Keeps a render error inside Seer Explorer from taking the page down with it.
 *
 * The sidebar and the popped-out window render Seer as a sibling of the routed
 * app, so without a boundary of its own a throw in the chat unmounts everything
 * up to the app-level boundary — the user loses the page they were on because
 * an assistant panel failed. (The drawer needs no wrapping: `GlobalDrawer`
 * already renders its content inside one.)
 *
 * Dismissable because these surfaces stay mounted: clearing the error is the
 * only way back to a working panel short of a reload.
 */
export function SeerExplorerErrorBoundary({children}: {children: React.ReactNode}) {
  return (
    <ErrorBoundary mini allowDismiss message={t('There was a problem with Seer.')}>
      {children}
    </ErrorBoundary>
  );
}
