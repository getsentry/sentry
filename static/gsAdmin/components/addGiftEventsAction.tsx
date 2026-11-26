import {useEffect} from 'react';
import {z} from 'zod';

import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';

import {DataCategory} from 'sentry/types/core';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';

import type {AdminConfirmRenderProps} from 'admin/components/adminConfirmationModal';
import {adminConfirmFormOptions} from 'admin/components/adminConfirmationModal';
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

const schema = z.object({
  freeEvents: z
    .number()
    .positive('Enter a number greater than zero')
    .nullable()
    .refine(value => value !== null, 'Enter a number greater than zero'),
});

const defaultValues: z.input<typeof schema> = {freeEvents: null};

function parseFreeEvents(value: string) {
  const intValue = parseInt(value, 10);
  return isNaN(intValue) || intValue < 0 ? null : intValue;
}

function formatThousands(value: number) {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Rendered as part of a openAdminConfirmModal call
 */
export function AddGiftEventsAction({
  billedCategoryInfo,
  dataCategory,
  subscription,
  onConfirm,
  setConfirmCallback,
  disableConfirmButton,
}: Props) {
  const multiplier = billedCategoryInfo?.freeEventsMultiple ?? 0;

  const form = useScrapsForm({
    ...defaultFormOptions,
    ...adminConfirmFormOptions(schema, disableConfirmButton),
    defaultValues,
    validators: {onDynamic: schema},
    onSubmit: ({value, meta}) => {
      onConfirm?.({
        [getFreeEventsKey(dataCategory)]: (value.freeEvents ?? 0) * multiplier,
        ...meta,
      });
    },
  });

  useEffect(() => {
    setConfirmCallback(params => form.handleSubmit(params));
  }, [setConfirmCallback, form]);

  const categoryName = getPlanCategoryName({
    plan: subscription.planDetails,
    category: dataCategory,
    capitalize: false,
  });

  function getLabel() {
    if (isByteCategory(dataCategory)) {
      return `How many ${categoryName} in GB?`;
    }
    if (isContinuousProfiling(dataCategory)) {
      return 'How many profile hours?';
    }
    if (isEmergeCategory(dataCategory)) {
      return `How many ${categoryName}?`;
    }

    const addToMessage =
      multiplier > 1 ? ` in multiples of ${formatThousands(multiplier)}s?` : '?';
    return `How many ${categoryName}${addToMessage} (50 is ${formatThousands(50 * multiplier)} ${categoryName})`;
  }

  function getHelp(freeEvents: number | null) {
    const total = ((freeEvents ?? 0) * multiplier).toLocaleString();

    let postFix = '';
    if (isContinuousProfiling(dataCategory)) {
      postFix = total === '1' ? ' hour' : ' hours';
    }
    if (isByteCategory(dataCategory)) {
      postFix = ' GB';
    }
    if (dataCategory === DataCategory.SIZE_ANALYSIS) {
      postFix = total === '1' ? ' build' : ' builds';
    }
    return `Total: ${total}${postFix}`;
  }

  return (
    <form.AppForm form={form}>
      <form.AppField name="freeEvents">
        {field => (
          <field.Layout.Stack label={getLabel()} hintText={getHelp(field.state.value)}>
            <field.Input
              autoFocus
              data-test-id={`num-free-${dataCategory}`}
              inputMode="numeric"
              pattern="[0-9]*"
              value={field.state.value === null ? '' : String(field.state.value)}
              onChange={value => field.handleChange(parseFreeEvents(value))}
            />
          </field.Layout.Stack>
        )}
      </form.AppField>
    </form.AppForm>
  );
}
