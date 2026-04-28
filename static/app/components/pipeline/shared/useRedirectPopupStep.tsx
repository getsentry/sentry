import {useCallback, useEffect, useRef, useState} from 'react';

import {ConfigStore} from 'sentry/stores/configStore';

/**
 * Configuration of the redirect popup
 */
export interface PopupOptions {
  height?: number;
  width?: number;
}

export type PopupStatus = 'not-open' | 'popup-open' | 'failed-to-open';

interface UseRedirectPopupStepOptions {
  /**
   * Called with the postMessage data when the popup completes the redirect flow.
   * Typically this calls `advance(callbackData)` to move the pipeline forward.
   */
  onCallback: (data: Record<string, string>) => void;
  /**
   * The URL to open in the popup.
   */
  redirectUrl: string | undefined;
  /**
   * Width and height of the popup window. Defaults to 1000x700.
   */
  popup?: PopupOptions;
}

interface UseRedirectPopupStepResult {
  isWaitingForCallback: boolean;
  /**
   * Opens the redirect popup. MUST be called from a user gesture (e.g. a
   * button click handler) — browsers block `window.open` outside of a
   * user-initiated call stack.
   */
  openPopup: () => void;
  popupStatus: PopupStatus;
}

/**
 * Manages a popup window for pipeline steps that redirect to an external
 * service (e.g. GitHub OAuth, GitHub App installation). Listens for a
 * postMessage callback from the trampoline page, and calls onCallback
 * with the received data.
 *
 * Usage in a step component:
 * ```tsx
 * function OAuthStep({stepData, advance}: PipelineStepProps<OAuthStepData>) {
 *   const {openPopup, popupStatus} = useRedirectPopupStep({
 *     redirectUrl: stepData.oauthUrl,
 *     onCallback: data => advance({code: data.code, state: data.state}),
 *   });
 *   if (popupStatus === 'popup-open') {
 *     return <p>Waiting... <button onClick={openPopup}>Reopen</button></p>;
 *   }
 *   return <button onClick={openPopup}>Authorize</button>;
 * }
 * ```
 */
export function useRedirectPopupStep({
  redirectUrl,
  onCallback,
  popup,
}: UseRedirectPopupStepOptions): UseRedirectPopupStepResult {
  const popupRef = useRef<Window | null>(null);
  const [popupStatus, setPopupStatus] = useState<PopupStatus>('not-open');

  const width = popup?.width ?? 650;
  const height = popup?.height ?? 750;

  const openPopupWindow = useCallback(
    (url: string) => {
      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.focus();
        return;
      }
      const left = Math.round(window.screenX + (window.outerWidth - width) / 2);
      const top = Math.round(window.screenY + (window.outerHeight - height) / 2);
      const features = `popup,width=${width},height=${height},left=${left},top=${top}`;

      const opened = window.open(url, 'pipeline_popup', features);
      popupRef.current = opened;

      setPopupStatus(opened ? 'popup-open' : 'failed-to-open');
    },
    [width, height]
  );

  // Listen for postMessage from the trampoline page in the popup.
  // The trampoline includes a `_pipeline_source: "sentry-pipeline"` key so we
  // can distinguish it from unrelated messages (browser extensions, devtools, etc.).
  // Prefixed with underscore to avoid colliding with provider callback query params.
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (!event.data || typeof event.data !== 'object') {
        return;
      }
      if (event.data._pipeline_source !== 'sentry-pipeline') {
        return;
      }

      const links = ConfigStore.get('links');
      const validOrigins = [
        links?.sentryUrl,
        links?.organizationUrl,
        document.location.origin,
      ];
      if (!validOrigins.includes(event.origin)) {
        return;
      }
      if (event.source !== popupRef.current) {
        return;
      }

      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close();
      }
      popupRef.current = null;

      setPopupStatus('not-open');
      const {_pipeline_source, ...callbackData} = event.data as Record<string, string>;
      onCallback(callbackData);
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onCallback]);

  // Close popup on unmount
  useEffect(() => {
    return () => {
      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close();
      }
    };
  }, []);

  const openPopup = useCallback(() => {
    if (redirectUrl) {
      openPopupWindow(redirectUrl);
    }
  }, [redirectUrl, openPopupWindow]);

  return {
    openPopup,
    popupStatus,
    isWaitingForCallback: popupStatus === 'popup-open',
  };
}
