import type {ReactNode} from 'react';
import {toast as sonnerToast} from 'sonner';

import {Toast} from './toast';
import type {ToastOptions, ToastVariant} from './types';

type ToastId = string | number;

const activeToastIds = new Map<ToastVariant, Set<ToastId>>();

function removeActiveToast(variant: ToastVariant, toastId: ToastId) {
  const ids = activeToastIds.get(variant);
  ids?.delete(toastId);

  if (ids?.size === 0) {
    activeToastIds.delete(variant);
  }
}

function dismissOtherVariants(variant: ToastVariant) {
  for (const [activeVariant, ids] of activeToastIds) {
    if (activeVariant === variant) {
      continue;
    }

    for (const toastId of ids) {
      sonnerToast.dismiss(toastId);
    }
    activeToastIds.delete(activeVariant);
  }
}

function show(variant: ToastVariant, message: ReactNode, options: ToastOptions = {}) {
  const {action, dismissible = true, duration, id, onDismiss} = options;

  dismissOtherVariants(variant);

  const toastId = sonnerToast.custom(
    renderedToastId => (
      <Toast
        variant={variant}
        message={message}
        action={action}
        onDismiss={dismissible ? () => sonnerToast.dismiss(renderedToastId) : undefined}
      />
    ),
    {
      duration,
      dismissible,
      onDismiss: dismissedToast => {
        removeActiveToast(variant, dismissedToast.id);
        onDismiss?.();
      },
      onAutoClose: dismissedToast => removeActiveToast(variant, dismissedToast.id),
      ...(id === undefined ? {} : {id}),
    }
  );

  const ids = activeToastIds.get(variant) ?? new Set<ToastId>();
  ids.add(toastId);
  activeToastIds.set(variant, ids);

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
  dismiss: (id?: ToastId) => {
    if (id === undefined) {
      activeToastIds.clear();
    } else {
      for (const variant of activeToastIds.keys()) {
        removeActiveToast(variant, id);
      }
    }

    return sonnerToast.dismiss(id);
  },
};
