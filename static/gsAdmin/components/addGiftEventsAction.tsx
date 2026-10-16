import {useCallback, useEffect, useState} from 'react';

import {TextField} from 'sentry/components/forms/fields/textField';
import {DataCategory} from 'sentry/types/core';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';

import type {
  AdminConfirmParams,
  AdminConfirmRenderProps,
} from 'admin/components/adminConfirmationModal';
import type {BilledDataCategoryInfo, Subscription} from 'getsentry/types';
import {
  getPlanCategoryName,
  isByteCategory,
  isContinuousProfiling,
  isEmergeCategory,
} from 'getsentry/utils/dataCategory';

export function getFreeEventsKey(dataCategory: DataCategory) {
  return `addFree${toTitleCase(dataCategory, {allowInnerUpperCase: true})}`;
}

type Props = AdminConfirmRenderProps & {
  billedCategoryInfo: BilledDataCategoryInfo | null;
  dataCategory: DataCategory;
  subscription: Subscription;
};

export function AddGiftEventsAction({
  billedCategoryInfo,
  dataCategory,
  subscription,
  setConfirmCallback,
  disableConfirmButton,
  onConfirm,
}: Props) {
  const [freeEvents, setFreeEvents] = useState<number | undefined>(undefined);

  function coerceValue(value: string) {
    const intValue = parseInt(value, 10);

    if (isNaN(intValue) || intValue < 0) {
      return undefined;
    }

    return intValue;
  }

  const calculatedTotal = (() => {
    if (!freeEvents) {
      return 0;
    }
    return freeEvents * (billedCategoryInfo?.freeEventsMultiple ?? 0);
  })();

  const handleConfirm = useCallback(
    (params: AdminConfirmParams) => {
      const freeEventsKey = getFreeEventsKey(dataCategory);
      const total = freeEvents ? freeEvents * (billedCategoryInfo?.freeEventsMultiple ?? 0) : 0;
      onConfirm?.({[freeEventsKey]: total, ...params});
      setFreeEvents(0);
    },
    [billedCategoryInfo?.freeEventsMultiple, dataCategory, freeEvents, onConfirm]
  );

  useEffect(() => {
    setConfirmCallback(handleConfirm);
    disableConfirmButton(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setConfirmCallback(handleConfirm);
  }, [handleConfirm, setConfirmCallback]);

  function handleChange(value: string) {
    const newFreeEvents = coerceValue(value);
    disableConfirmButton(newFreeEvents === 0 || newFreeEvents === undefined);
    setFreeEvents(newFreeEvents);
  }

  function getlabel() {
    const categoryName = getPlanCategoryName({
      plan: subscription.planDetails,
      category: dataCategory,
      capitalize: false,
    });

    if (isByteCategory(dataCategory)) {
      return `How many ${categoryName} in GB?`;
    }
    if (isContinuousProfiling(dataCategory)) {
      return 'How many profile hours?';
    }
    if (isEmergeCategory(dataCategory)) {
      return `How many ${categoryName}?`;
    }

    const multiplier = billedCategoryInfo?.freeEventsMultiple ?? 0;
    const addToMessage =
      multiplier > 1
        ? ` in multiples of ${multiplier.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}s?`
        : '?';
    return `How many ${categoryName}${addToMessage} (50 is ${(50 * multiplier).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')} ${categoryName})`;
  }

  const total = calculatedTotal.toLocaleString();
  function getHelp() {
    let postFix = '';
    if (isContinuousProfiling(dataCategory)) {
      if (total === '1') {
        postFix = ' hour';
      } else {
        postFix = ' hours';
      }
    }
    if (isByteCategory(dataCategory)) {
      postFix = ' GB';
    }
    if (dataCategory === DataCategory.SIZE_ANALYSIS) {
      postFix = total === '1' ? ' build' : ' builds';
    }
    if (dataCategory === DataCategory.INSTALLABLE_BUILD) {
      postFix = total === '1' ? ' install' : ' installs';
    }
    return `Total: ${total}${postFix}`;
  }

  return (
    <TextField
      autoFocus
      inline={false}
      stacked
      flexibleControlStateSize
      data-test-id={`num-free-${dataCategory}`}
      label={getlabel()}
      help={getHelp()}
      name={dataCategory}
      inputMode="numeric"
      pattern="[0-9]*"
      value={freeEvents && !isNaN(freeEvents) ? freeEvents.toString() : ''}
      onChange={handleChange}
    />
  );
}
