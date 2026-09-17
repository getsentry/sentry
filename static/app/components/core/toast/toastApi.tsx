import type {ReactNode} from 'react';
import {toast as sonnerToast} from 'sonner';

import {Toast} from './toast';
import type {ToastOptions, ToastVariant} from './types';

const activeToastIds = new Map<string | number, ToastVariant>();

function show(variant: ToastVariant, message: ReactNode, options: ToastOptions = {}) {
  const {action, duration, id, onDismiss} = options;

  // Explicit IDs opt out of automatic replacement, including when updating a toast.
  if (id === undefined) {
    for (const [activeId, activeVariant] of activeToastIds) {
      if (activeVariant !== variant) {
        sonnerToast.dismiss(activeId);
        activeToastIds.delete(activeId);
      }
    }
  } else {
    activeToastIds.delete(id);
  }

  const toastId = sonnerToast.custom(
    renderedToastId => (
      <Toast
        variant={variant}
        message={message}
        action={action}
        onDismiss={() => {
          activeToastIds.delete(renderedToastId);
          sonnerToast.dismiss(renderedToastId);
        }}
      />
    ),
    {
      duration,
      onDismiss: dismissedToast => {
        activeToastIds.delete(dismissedToast.id);
        onDismiss?.();
      },
      onAutoClose: dismissedToast => {
        activeToastIds.delete(dismissedToast.id);
        onDismiss?.();
      },
      ...(id === undefined ? {} : {id}),
    }
  );

  if (id === undefined) {
    activeToastIds.set(toastId, variant);
  }

  return toastId;
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
  dismiss: (id?: string | number) => {
    if (id === undefined) {
      activeToastIds.clear();
    } else {
      activeToastIds.delete(id);
    }
    return sonnerToast.dismiss(id);
  },
};
