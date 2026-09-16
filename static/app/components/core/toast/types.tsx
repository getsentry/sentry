import type {ReactNode} from 'react';

export const DEFAULT_TOAST_DURATION = 6000;

export type ToastVariant = 'success' | 'error' | 'loading' | 'default';

export interface ToastAction {
  label: ReactNode;
  onClick: () => void;
  icon?: ReactNode;
}

export interface ToastOptions {
  /** Renders a button next to the message. The toast dismisses after onClick. */
  action?: ToastAction;
  /** ms. Use `Infinity` to keep the toast until it is dismissed. */
  duration?: number;
  /** Pass an existing id to replace that toast instead of adding one. */
  id?: string | number;
  onDismiss?: () => void;
}
