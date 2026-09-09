import {isValidElement} from 'react';
import * as Sentry from '@sentry/react';

import {toast, type ToastOptions} from '@sentry/scraps/toast';

import {IconRefresh} from 'sentry/icons';
import {t} from 'sentry/locale';
import {isDemoModeActive} from 'sentry/utils/demoMode';

type IndicatorType = 'loading' | 'error' | 'success' | 'undo' | '';

interface IndicatorOptions {
  append?: boolean;
  disableDismiss?: boolean;
  duration?: number | null;
  undo?: () => void;
}

type UndoIndicatorOptions = IndicatorOptions & {undo: () => void};

// Clears all indicators
/**
 * @deprecated Use `toast.dismiss()` from `@sentry/scraps/toast` instead.
 */
export function clearIndicators() {
  toast.dismiss();
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
  const {duration: optionsDuration, disableDismiss, undo} = options;

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

  const toastOptions: ToastOptions = {
    dismissible: disableDismiss !== true,
  };

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

  switch (type) {
    case 'loading':
      toast.loading(msg, toastOptions);
      break;
    case 'error':
      toast.error(msg, toastOptions);
      break;
    case 'success':
      toast.success(msg, toastOptions);
      break;
    case 'undo':
    case '':
      toast.message(msg, toastOptions);
      break;
  }
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
