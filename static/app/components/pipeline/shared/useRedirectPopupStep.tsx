import {useCallback, useEffect, useRef, useState} from 'react';

import {ConfigStore} from 'sentry/stores/configStore';

/**
 * Configuration of the redirect popup
 */
export interface PopupOptions {
  height?: number;
  width?: number;
}

type PopupStatus = 'not-open' | 'popup-open' | 'failed-to-open';

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

const PIPELINE_SOURCE = 'sentry-pipeline';
const PIPELINE_POPUP_NAME_PREFIX = 'pipeline_popup_';

function createPopupNonce(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Manages a popup window for pipeline steps that redirect to an external
 * service (e.g. GitHub OAuth, GitHub App installation). Listens for a
 * postMessage callback from the trampoline page, and calls onCallback
 * with the received data.
 *
 * Auth messages are accepted when origin + `_pipeline_source` match and either:
 * - `_pipeline_nonce` matches the nonce embedded in the popup `window.name`
 *   (preferred; survives Safari WindowProxy identity churn after cross-origin
 *   navigations), or
 * - `event.source === popupRef.current` (fallback for older trampolines / tests)
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
  const nonceRef = useRef<string | null>(null);
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

      // Embed a one-shot nonce in the popup target name. `window.name` survives
      // cross-origin navigations (GitHub → trampoline), so the trampoline can
      // echo it back via postMessage without relying on WindowProxy identity.
      const nonce = createPopupNonce();
      nonceRef.current = nonce;
      const windowName = `${PIPELINE_POPUP_NAME_PREFIX}${nonce}`;

      const opened = window.open(url, windowName, features);
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

      // MessageEvent.data is typed as `any`; narrow once so locals stay typed.
      const data = event.data as Record<string, unknown>;
      if (data._pipeline_source !== PIPELINE_SOURCE) {
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

      const expectedNonce = nonceRef.current;
      const messageNonce: string | null =
        typeof data._pipeline_nonce === 'string' ? data._pipeline_nonce : null;
      const nonceMatches = Boolean(
        expectedNonce && messageNonce && messageNonce === expectedNonce
      );
      const sourceMatches = event.source === popupRef.current;

      // Prefer nonce (Safari-safe). Keep source equality as a fallback so older
      // trampolines and existing tests that only mock event.source still work.
      if (!nonceMatches && !sourceMatches) {
        return;
      }

      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close();
      }
      popupRef.current = null;
      nonceRef.current = null;

      setPopupStatus('not-open');
      const {_pipeline_source: _source, _pipeline_nonce: _nonce, ...callbackData} =
        data as Record<string, string>;
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
