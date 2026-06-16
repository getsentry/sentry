import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {uuid4} from '@sentry/core';

import {localStorageWrapper} from 'sentry/utils/localStorage';
import type {AlertVariant} from 'sentry/utils/theme';

export interface GlobalAlert {
  /**
   * The alert content. Accepts arbitrary React nodes so callers can embed
   * links, formatting, or `tct` translations.
   */
  message: React.ReactNode;
  /**
   * Visual style. Maps directly onto the underlying `<Alert>` component
   * variant.
   */
  variant: AlertVariant;
  /**
   * Stable identifier for the alert. Presence enables persistence
   * features: muting via localStorage on close (so the alert stays
   * dismissed across page loads) and `noDuplicates` deduplication.
   * Without an id the alert is treated as transient and auto-closes
   * after a short delay.
   */
  id?: string;
  /**
   * When true, the alert is never auto-closed. Use to override the
   * transient default for an id-less alert that should still stay
   * until the user dismisses it.
   */
  neverExpire?: boolean;
  /**
   * When true, `addAlert` is a no-op if another alert with the same `id`
   * is already showing. Requires `id` to be set.
   */
  noDuplicates?: boolean;
  /**
   * Renders the alert with an opaque background. Used for high-priority
   * system banners that should visually stand out.
   */
  opaque?: boolean;
  /**
   * Optional URL. When present, the alert's message is rendered as an
   * external link to this URL.
   */
  url?: string;
}

export interface StoredGlobalAlert extends GlobalAlert {
  key: string;
}

export type AddAlert = (alert: GlobalAlert) => void;

interface GlobalAlertContextValue {
  addAlert: AddAlert;
  alerts: readonly StoredGlobalAlert[];
  closeAlert: (alert: StoredGlobalAlert, muteDurationSeconds?: number) => void;
}

const MUTED_STORAGE_KEY = 'alerts:muted';
const DEFAULT_MUTE_DURATION_SECONDS = 60 * 60 * 24 * 7;
const EXPIRE_MS = 5000;

const GlobalAlertContext = createContext<GlobalAlertContextValue | null>(null);

function readMutedAlerts(): Record<string, number> {
  const raw = localStorageWrapper.getItem(MUTED_STORAGE_KEY);
  if (typeof raw !== 'string' || raw.length === 0) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function isAlertMuted(muted: Record<string, number>, id: string): boolean {
  const expiry = muted[id];
  return typeof expiry === 'number' && expiry >= Math.floor(Date.now() / 1000);
}

function writeMutedAlerts(muted: Record<string, number>) {
  localStorageWrapper.setItem(MUTED_STORAGE_KEY, JSON.stringify(muted));
}

interface Props {
  children: React.ReactNode;
}

export function GlobalAlertProvider({children}: Props) {
  const [alerts, setAlerts] = useState<readonly StoredGlobalAlert[]>([]);
  const timersRef = useRef(new Map<string, number>());

  const closeAlert = useCallback(
    (alert: StoredGlobalAlert, muteDurationSeconds = DEFAULT_MUTE_DURATION_SECONDS) => {
      if (alert.id !== undefined) {
        const muted = readMutedAlerts();
        muted[alert.id] = Math.floor(Date.now() / 1000) + muteDurationSeconds;
        writeMutedAlerts(muted);
      }

      const timer = timersRef.current.get(alert.key);
      if (timer !== undefined) {
        window.clearTimeout(timer);
        timersRef.current.delete(alert.key);
      }

      setAlerts(prev => prev.filter(a => a.key !== alert.key));
    },
    []
  );

  const addAlert = useCallback(
    (alert: GlobalAlert) => {
      if (alert.id !== undefined && isAlertMuted(readMutedAlerts(), alert.id)) {
        return;
      }

      const key = uuid4();
      const stored: StoredGlobalAlert = {...alert, key};

      setAlerts(prev =>
        alert.noDuplicates && alert.id !== undefined && prev.some(a => a.id === alert.id)
          ? prev
          : [...prev, stored]
      );

      if (alert.id === undefined && !alert.neverExpire) {
        const timerId = window.setTimeout(() => closeAlert(stored), EXPIRE_MS);
        timersRef.current.set(key, timerId);
      }
    },
    [closeAlert]
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach(timer => window.clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const value = useMemo<GlobalAlertContextValue>(
    () => ({alerts, addAlert, closeAlert}),
    [alerts, addAlert, closeAlert]
  );

  return (
    <GlobalAlertContext.Provider value={value}>{children}</GlobalAlertContext.Provider>
  );
}

export function useGlobalAlerts(): GlobalAlertContextValue {
  const context = useContext(GlobalAlertContext);
  if (!context) {
    throw new Error('useGlobalAlerts must be used within a GlobalAlertProvider');
  }
  return context;
}
