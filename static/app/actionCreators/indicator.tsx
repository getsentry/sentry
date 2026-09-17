import {isValidElement} from 'react';
import * as Sentry from '@sentry/react';

import {toast, type ToastOptions} from '@sentry/scraps/toast';

import {IconRefresh} from 'sentry/icons';
import {t} from 'sentry/locale';
import {isDemoModeActive} from 'sentry/utils/demoMode';

type IndicatorType = 'loading' | 'error' | 'success' | 'undo' | '';

const activeIndicatorIds = new Map<IndicatorType, Set<string | number>>();

interface IndicatorOptions {
  append?: boolean;
  duration?: number | null;
  undo?: () => void;
}

type UndoIndicatorOptions = IndicatorOptions & {undo: () => void};

// Clears all legacy indicators
/**
 * @deprecated Use `toast.dismiss()` from `@sentry/scraps/toast` instead.
 */
export function clearIndicators() {
  for (const ids of activeIndicatorIds.values()) {
    for (const id of ids) {
      toast.dismiss(id);
    }
  }
  activeIndicatorIds.clear();
}

/**
 * @deprecated Use the namespaced API from `@sentry/scraps/toast` instead.
 */
export function addMessage(
  msg: React.ReactNode,
  type: 'undo',
  options: UndoIndicatorOptions
): void;
export function addMessage(
  msg: React.ReactNode,
  type: Exclude<IndicatorType, 'undo'>,
  options?: IndicatorOptions
): void;
export function addMessage(
  msg: React.ReactNode,
  type: IndicatorType,
  options: IndicatorOptions = {}
): void {
  const {duration: optionsDuration, undo} = options;

  // XXX: Debug for https://sentry.io/organizations/sentry/issues/1595204979/
  if (
    (msg as any)?.message !== undefined &&
    (msg as any)?.code !== undefined &&
    (msg as any)?.extra !== undefined
  ) {
    Sentry.captureException(new Error('Attempt to XHR response to Indicators'));
  }
  if (type === 'undo' && typeof options.undo !== 'function') {
    Sentry.captureException(
      new Error('Rendered undo toast without undo function, this should not happen.')
    );
  }

  const toastOptions: ToastOptions = {};

  if (optionsDuration !== undefined) {
    toastOptions.duration =
      optionsDuration === null || optionsDuration === 0 ? Infinity : optionsDuration;
  }

  if (typeof undo === 'function') {
    toastOptions.action = {
      label: t('Undo'),
      icon: <IconRefresh size="xs" />,
      onClick: undo,
    };
  }

  // Preserve replacement behavior for legacy indicators without clearing newer toasts.
  const variant = type === 'undo' ? '' : type;
  for (const [activeVariant, ids] of activeIndicatorIds) {
    if (activeVariant !== variant) {
      for (const id of ids) {
        toast.dismiss(id);
      }
      activeIndicatorIds.delete(activeVariant);
    }
  }

  const ids = activeIndicatorIds.get(variant) ?? new Set<string | number>();
  const showToast = {
    loading: toast.loading,
    error: toast.error,
    success: toast.success,
    '': toast.message,
  }[variant];
  const id = showToast(msg, {
    ...toastOptions,
    onDismiss: () => {
      const activeIds = activeIndicatorIds.get(variant);
      activeIds?.delete(id);
      if (activeIds?.size === 0) {
        activeIndicatorIds.delete(variant);
      }
    },
  });
  ids.add(id);
  activeIndicatorIds.set(variant, ids);
}

/**
 * @deprecated Use `toast.loading()` from `@sentry/scraps/toast` instead.
 */
export function addLoadingMessage(
  msg: React.ReactNode = t('Saving changes...'),
  options?: IndicatorOptions
) {
  return addMessage(msg, 'loading', options);
}

/**
 * @deprecated Use `toast.error()` from `@sentry/scraps/toast` instead.
 */
export function addErrorMessage(msg: React.ReactNode, options?: IndicatorOptions) {
  if (isDemoModeActive()) {
    return addMessage(t('This action is not allowed in demo mode.'), 'error', options);
  }
  if (typeof msg === 'string' || isValidElement(msg)) {
    return addMessage(msg, 'error', options);
  }
  // When non string, non-react element responses are passed, addErrorMessage
  // crashes the entire page because it falls outside any error
  // boundaries defined for the components on the page. Adding a fallback
  // to prevent page crashes.
  return addMessage(
    t(
      "You've hit an issue, fortunately we use Sentry to monitor Sentry. So it's likely we're already looking into this!"
    ),
    'error',
    options
  );
}

/**
 * @deprecated Use `toast.success()` from `@sentry/scraps/toast` instead.
 */
export function addSuccessMessage(
  msg: React.ReactNode,
  options?: IndicatorOptions | UndoIndicatorOptions
) {
  return addMessage(msg, 'success', options);
}
