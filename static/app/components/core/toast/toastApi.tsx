import type {ReactNode} from 'react';
import {toast as sonnerToast} from 'sonner';

import {Toast} from './toast';
import type {ToastOptions, ToastVariant} from './types';

function show(variant: ToastVariant, message: ReactNode, options: ToastOptions = {}) {
  const {action, duration, id, onDismiss} = options;

  return sonnerToast.custom(
    renderedToastId => (
      <Toast
        variant={variant}
        message={message}
        action={action}
        onDismiss={() => sonnerToast.dismiss(renderedToastId)}
      />
    ),
    {
      duration,
      onDismiss,
      onAutoClose: onDismiss,
      ...(id === undefined ? {} : {id}),
    }
  );
}

export const toast = {
  success: (message: ReactNode, options?: ToastOptions) =>
    show('success', message, options),
  error: (message: ReactNode, options?: ToastOptions) => show('error', message, options),
  loading: (message: ReactNode, options?: ToastOptions) =>
    show('loading', message, options),
  message: (message: ReactNode, options?: ToastOptions) =>
    show('default', message, options),
  /** Dismisses one toast, or every toast when called with no id. */
  dismiss: sonnerToast.dismiss,
};
