import {isValidElement} from 'react';
import * as Sentry from '@sentry/react';

import type FormModel from 'sentry/components/forms/model';
import {DEFAULT_TOAST_DURATION} from 'sentry/constants';
import {t} from 'sentry/locale';
import IndicatorStore from 'sentry/stores/indicatorStore';
import {isDemoModeActive} from 'sentry/utils/demoMode';

type IndicatorType = 'loading' | 'error' | 'success' | 'undo' | '';

interface IndicatorOptions {
  append?: boolean;
  disableDismiss?: boolean;
  duration?: number | null;
  undo?: () => void;
}

type UndoIndicatorOptions = IndicatorOptions & {undo: () => void};

interface UndoableIndicatorOptions extends IndicatorOptions {
  formModel: {
    id: string;
    model: FormModel;
  };
}

export type Indicator = {
  id: string | number;
  message: React.ReactNode;
  options: IndicatorOptions;
  type: IndicatorType;
  clearId?: null | number;
};

// Clears all indicators
export function clearIndicators() {
  IndicatorStore.clear();
}

// Note previous IndicatorStore.add behavior was to default to "loading" if no type was supplied
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
  const {duration: optionsDuration, append, ...rest} = options;

  // XXX: Debug for https://sentry.io/organizations/sentry/issues/1595204979/
  if (
    typeof (msg as any)?.message !== 'undefined' &&
    typeof (msg as any)?.code !== 'undefined' &&
    typeof (msg as any)?.extra !== 'undefined'
  ) {
    Sentry.captureException(new Error('Attempt to XHR response to Indicators'));
  }
  if (type === 'undo' && typeof options.undo !== 'function') {
    Sentry.captureException(
      new Error('Rendered undo toast without undo function, this should not happen.')
    );
  }

  // use default only if undefined, as 0 is a valid duration
  const duration =
    typeof optionsDuration === 'undefined' ? DEFAULT_TOAST_DURATION : optionsDuration;

  const action = append ? 'append' : 'add';
  // XXX: This differs from `IndicatorStore.add` since it won't return the indicator that is created
  // because we are firing an action. You can just add a new message and it will, by default,
  // replace active indicator
  IndicatorStore[action](msg, type, {...rest, duration});
}

export function addLoadingMessage(
  msg: React.ReactNode = t('Saving changes...'),
  options?: IndicatorOptions
) {
  return addMessage(msg, 'loading', options);
}

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

export function addSuccessMessage(
  msg: React.ReactNode,
  options?: IndicatorOptions | UndoableIndicatorOptions
) {
  return addMessage(msg, 'success', options);
}
