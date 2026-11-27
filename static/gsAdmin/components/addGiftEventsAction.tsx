import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';

import {DataCategory} from 'sentry/types/core';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';

import type {AdminActionModalProps} from 'admin/components/adminConfirmationModal';
import {
  AdminAuditFields,
  adminAuditDefaults,
  adminAuditParams,
  adminAuditSchema,
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

type Props = AdminActionModalProps & {
  billedCategoryInfo: BilledDataCategoryInfo | null;
  dataCategory: DataCategory;
  subscription: Subscription;
};

const schema = z.object({
  freeEvents: z
    .number({error: 'Enter a number greater than zero'})
    .positive('Enter a number greater than zero'),
  audit: adminAuditSchema,
});

const defaultValues: {audit: typeof adminAuditDefaults; freeEvents: number | null} = {
  freeEvents: null,
  audit: adminAuditDefaults,
};

function parseFreeEvents(value: string) {
  const intValue = parseInt(value, 10);
  return isNaN(intValue) || intValue < 0 ? null : intValue;
}

function formatThousands(value: number) {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Modal for gifting free events in a data category
 */
export function AddGiftEventsAction({
  Header,
  Body,
  Footer,
  closeModal,
  header,
  onConfirm,
  billedCategoryInfo,
  dataCategory,
  subscription,
}: Props) {
  const multiplier = billedCategoryInfo?.freeEventsMultiple ?? 0;

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues,
    validators: {onDynamic: schema},
    onSubmit: ({value}) => {
      onConfirm({
        [getFreeEventsKey(dataCategory)]: (value.freeEvents ?? 0) * multiplier,
        ...adminAuditParams(value.audit),
      });
      closeModal();
    },
  });

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
      {header && <Header>{header}</Header>}
      <Body>
        <Stack gap="xl">
          <form.AppField name="freeEvents">
            {field => (
              <field.Layout.Stack
                label={getLabel()}
                hintText={getHelp(field.state.value)}
              >
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
          <AdminAuditFields form={form} fields="audit" />
        </Stack>
      </Body>
      <Footer>
        <Flex align="center" gap="xl">
          <Button onClick={closeModal}>Cancel</Button>
          <form.SubmitButton>Confirm</form.SubmitButton>
        </Flex>
      </Footer>
    </form.AppForm>
  );
}
