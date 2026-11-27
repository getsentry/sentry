import {Fragment} from 'react';
import {useMutation} from '@tanstack/react-query';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Flex} from '@sentry/scraps/layout';
import type {ModalRenderProps} from '@sentry/scraps/modal';
import {openModal} from '@sentry/scraps/modal';
import {toast} from '@sentry/scraps/toast';

import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';

import type {Subscription} from 'getsentry/types';

type Props = {
  onSuccess: () => void;
  organization: Organization;
  subscription: Subscription;
};

type ModalProps = Props & ModalRenderProps;

const RETENTION_STEP_DAYS = 30;
const MAX_RETENTION_DAYS = 390;

const RETENTION_DAY_CHOICES = Array.from(
  {length: MAX_RETENTION_DAYS / RETENTION_STEP_DAYS},
  (_, i) => (i + 1) * RETENTION_STEP_DAYS
);

const RETENTION_CATEGORIES = [
  {category: DataCategory.LOG_BYTE, label: 'Logs'},
  {category: DataCategory.TRACE_METRIC_BYTE, label: 'Metrics'},
  {category: DataCategory.TRANSACTIONS, label: 'Transactions'},
  {category: DataCategory.SPANS, label: 'Spans'},
] as const;

const RETENTION_TIERS = [
  {tier: 'standard', label: 'Standard'},
  {tier: 'downsampled', label: 'Downsampled'},
] as const;

type RetentionCategory = (typeof RETENTION_CATEGORIES)[number]['category'];

const retentionDays = z.number().nullable();
const retentionPair = z.object({standard: retentionDays, downsampled: retentionDays});

const schema = z.object({
  orgStandard: retentionDays,
  retentions: z.object({
    [DataCategory.LOG_BYTE]: retentionPair,
    [DataCategory.TRACE_METRIC_BYTE]: retentionPair,
    [DataCategory.TRANSACTIONS]: retentionPair,
    [DataCategory.SPANS]: retentionPair,
  }),
});

type RetentionValues = z.infer<typeof schema>;
type RetentionPair = z.infer<typeof retentionPair>;

type RetentionSettingsPayload = {
  orgRetention: RetentionPair;
  retentions: Partial<Record<RetentionCategory, RetentionPair>>;
};

type RetentionOption = {label: string; value: number};

/**
 * Retention must be picked from multiples of 30. Existing values
 * that predate this restriction are kept as an option so they aren't silently
 * dropped when the form is submitted.
 */
function getRetentionOptions(currentValue: number | null): RetentionOption[] {
  const options: RetentionOption[] = RETENTION_DAY_CHOICES.map(days => ({
    value: days,
    label: days === currentValue ? `${days} days (current)` : `${days} days`,
  }));

  if (currentValue !== null && !options.some(option => option.value === currentValue)) {
    options.unshift({value: currentValue, label: `${currentValue} days (current)`});
  }

  return options;
}

function getCategoryRetention(
  subscription: Subscription,
  category: RetentionCategory
): RetentionPair {
  const retention = subscription.categories[category]?.retention;
  return {
    standard: retention?.standard ?? null,
    downsampled: retention?.downsampled ?? null,
  };
}

function getErrorMessage(error: unknown): string {
  const detail = error instanceof RequestError ? error.responseJSON?.detail : undefined;
  if (typeof detail === 'string') {
    return detail;
  }
  if (typeof detail === 'object' && detail?.message) {
    return detail.message;
  }
  return 'Failed to update retention settings.';
}

function UpdateRetentionSettingsModal({
  onSuccess,
  organization,
  subscription,
  closeModal,
  Header,
  Body,
  Footer,
}: ModalProps) {
  const planCategories = RETENTION_CATEGORIES.filter(({category}) =>
    subscription.planDetails.categories.includes(category)
  );

  const defaultValues: RetentionValues = {
    orgStandard: subscription.orgRetention?.standard ?? null,
    retentions: {
      [DataCategory.LOG_BYTE]: getCategoryRetention(subscription, DataCategory.LOG_BYTE),
      [DataCategory.TRACE_METRIC_BYTE]: getCategoryRetention(
        subscription,
        DataCategory.TRACE_METRIC_BYTE
      ),
      [DataCategory.TRANSACTIONS]: getCategoryRetention(
        subscription,
        DataCategory.TRANSACTIONS
      ),
      [DataCategory.SPANS]: getCategoryRetention(subscription, DataCategory.SPANS),
    },
  };

  const mutation = useMutation({
    mutationFn: (data: RetentionSettingsPayload) =>
      fetchMutation({
        url: getApiUrl('/_admin/customers/$organizationIdOrSlug/retention-settings/', {
          path: {organizationIdOrSlug: organization.slug},
        }),
        method: 'POST',
        data,
      }),
    onSuccess: () => {
      toast.success('Retention settings updated successfully.');
      closeModal();
      onSuccess();
    },
    onError: error => {
      toast.error(getErrorMessage(error));
    },
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues,
    validators: {onDynamic: schema},
    onSubmit: ({value}) =>
      mutation
        .mutateAsync({
          orgRetention: {standard: value.orgStandard, downsampled: null},
          retentions: Object.fromEntries(
            planCategories.map(({category}) => [category, value.retentions[category]])
          ),
        })
        .catch(() => {}),
  });

  return (
    <form.AppForm form={form}>
      <Header closeButton>Update Retention Settings</Header>
      <Body>
        <div>
          <p>
            Update the retention settings for each data category. Retention must be a
            multiple of 30 days. Clearing a field defaults to the plan's retention value
            for the category.
          </p>
        </div>
        <br />
        <form.AppField name="orgStandard">
          {field => (
            <field.Layout.Row label="Org Retention">
              <field.Select
                clearable
                placeholder="Plan default"
                value={field.state.value}
                onChange={field.handleChange}
                options={getRetentionOptions(defaultValues.orgStandard)}
              />
            </field.Layout.Row>
          )}
        </form.AppField>
        {planCategories.map(({category, label}) => (
          <Fragment key={category}>
            {RETENTION_TIERS.map(({tier, label: tierLabel}) => (
              <form.AppField key={tier} name={`retentions.${category}.${tier}`}>
                {field => (
                  <field.Layout.Row label={`${label} ${tierLabel}`}>
                    <field.Select
                      clearable
                      placeholder="Plan default"
                      value={field.state.value}
                      onChange={field.handleChange}
                      options={getRetentionOptions(
                        defaultValues.retentions[category][tier]
                      )}
                    />
                  </field.Layout.Row>
                )}
              </form.AppField>
            ))}
          </Fragment>
        ))}
      </Body>
      <Footer>
        <Flex gap="md" justify="end">
          <Button onClick={closeModal}>Cancel</Button>
          <form.SubmitButton>Update Settings</form.SubmitButton>
        </Flex>
      </Footer>
    </form.AppForm>
  );
}

type Options = Pick<Props, 'onSuccess' | 'organization' | 'subscription'>;

export const openUpdateRetentionSettingsModal = (opts: Options) =>
  openModal(deps => <UpdateRetentionSettingsModal {...deps} {...opts} />, {
    closeEvents: 'escape-key',
  });
