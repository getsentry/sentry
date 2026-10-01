import {Fragment} from 'react';
import {useMutation} from '@tanstack/react-query';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
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
    options.unshift({
      value: currentValue,
      label: `${currentValue} days (current)`,
    });
  }

  return options;
}

const retentionSchema = z.object({
  orgStandard: z.number().nullable(),
  logBytesStandard: z.number().nullable(),
  logBytesDownsampled: z.number().nullable(),
  transactionsStandard: z.number().nullable(),
  transactionsDownsampled: z.number().nullable(),
  spansStandard: z.number().nullable(),
  spansDownsampled: z.number().nullable(),
});

function UpdateRetentionSettingsModal({
  onSuccess,
  organization,
  subscription,
  closeModal,
  Header,
  Body,
  Footer,
}: ModalProps) {
  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof retentionSchema>) => {
      const retentions: Partial<
        Record<DataCategory, {downsampled: number | null; standard: number | null}>
      > = {};

      if (subscription.planDetails.categories.includes(DataCategory.LOG_BYTE)) {
        retentions.logBytes = {
          standard: values.logBytesStandard,
          downsampled: values.logBytesDownsampled,
        };
      }

      if (subscription.planDetails.categories.includes(DataCategory.TRANSACTIONS)) {
        retentions.transactions = {
          standard: values.transactionsStandard,
          downsampled: values.transactionsDownsampled,
        };
      }

      if (subscription.planDetails.categories.includes(DataCategory.SPANS)) {
        retentions.spans = {
          standard: values.spansStandard,
          downsampled: values.spansDownsampled,
        };
      }

      const orgRetention = {
        standard: values.orgStandard,
        downsampled: null,
      };

      return fetchMutation({
        url: getApiUrl('/_admin/customers/$organizationIdOrSlug/retention-settings/', {
          path: {organizationIdOrSlug: organization.slug},
        }),
        method: 'POST',
        data: {retentions, orgRetention},
      });
    },
    onSuccess: () => {
      addSuccessMessage('Retention settings updated successfully.');
      closeModal();
      onSuccess();
    },
    onError: e => {
      const err = e instanceof RequestError ? e : undefined;
      const detail = err?.responseJSON?.detail;
      const message =
        typeof detail === 'string'
          ? detail
          : typeof detail === 'object' && detail?.message
            ? detail.message
            : 'Failed to update retention settings.';
      addErrorMessage(message);
    },
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      orgStandard: subscription.orgRetention?.standard ?? null,
      logBytesStandard: subscription.categories.logBytes?.retention?.standard ?? null,
      logBytesDownsampled:
        subscription.categories.logBytes?.retention?.downsampled ?? null,
      transactionsStandard:
        subscription.categories.transactions?.retention?.standard ?? null,
      transactionsDownsampled:
        subscription.categories.transactions?.retention?.downsampled ?? null,
      spansStandard: subscription.categories.spans?.retention?.standard ?? null,
      spansDownsampled: subscription.categories.spans?.retention?.downsampled ?? null,
    },
    validators: {onDynamic: retentionSchema},
    onSubmit: ({value}) => mutation.mutateAsync(value).catch(() => {}),
  });

  return (
    <form.AppForm form={form}>
      <Header closeButton>
        <Heading as="h4">Update Retention Settings</Heading>
      </Header>
      <Body>
        <Stack gap="lg">
          <Text>
            Update the retention settings for each data category. Retention must be a
            multiple of 30 days. Clearing a field defaults to the plan's retention value
            for the category.
          </Text>
          <form.AppField name="orgStandard">
            {field => (
              <field.Layout.Stack label="Org Retention">
                <field.Select
                  value={field.state.value}
                  onChange={field.handleChange}
                  options={getRetentionOptions(
                    subscription.orgRetention?.standard ?? null
                  )}
                  placeholder="Plan default"
                  clearable
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          {subscription.planDetails.categories.includes(DataCategory.LOG_BYTE) && (
            <Fragment>
              <form.AppField name="logBytesStandard">
                {field => (
                  <field.Layout.Stack label="Logs Standard">
                    <field.Select
                      value={field.state.value}
                      onChange={field.handleChange}
                      options={getRetentionOptions(
                        subscription.categories.logBytes?.retention?.standard ?? null
                      )}
                      placeholder="Plan default"
                      clearable
                    />
                  </field.Layout.Stack>
                )}
              </form.AppField>
              <form.AppField name="logBytesDownsampled">
                {field => (
                  <field.Layout.Stack label="Logs Downsampled">
                    <field.Select
                      value={field.state.value}
                      onChange={field.handleChange}
                      options={getRetentionOptions(
                        subscription.categories.logBytes?.retention?.downsampled ?? null
                      )}
                      placeholder="Plan default"
                      clearable
                    />
                  </field.Layout.Stack>
                )}
              </form.AppField>
            </Fragment>
          )}

          {subscription.planDetails.categories.includes(DataCategory.TRANSACTIONS) && (
            <Fragment>
              <form.AppField name="transactionsStandard">
                {field => (
                  <field.Layout.Stack label="Transactions Standard">
                    <field.Select
                      value={field.state.value}
                      onChange={field.handleChange}
                      options={getRetentionOptions(
                        subscription.categories.transactions?.retention?.standard ?? null
                      )}
                      placeholder="Plan default"
                      clearable
                    />
                  </field.Layout.Stack>
                )}
              </form.AppField>
              <form.AppField name="transactionsDownsampled">
                {field => (
                  <field.Layout.Stack label="Transactions Downsampled">
                    <field.Select
                      value={field.state.value}
                      onChange={field.handleChange}
                      options={getRetentionOptions(
                        subscription.categories.transactions?.retention?.downsampled ??
                          null
                      )}
                      placeholder="Plan default"
                      clearable
                    />
                  </field.Layout.Stack>
                )}
              </form.AppField>
            </Fragment>
          )}

          {subscription.planDetails.categories.includes(DataCategory.SPANS) && (
            <Fragment>
              <form.AppField name="spansStandard">
                {field => (
                  <field.Layout.Stack label="Spans Standard">
                    <field.Select
                      value={field.state.value}
                      onChange={field.handleChange}
                      options={getRetentionOptions(
                        subscription.categories.spans?.retention?.standard ?? null
                      )}
                      placeholder="Plan default"
                      clearable
                    />
                  </field.Layout.Stack>
                )}
              </form.AppField>
              <form.AppField name="spansDownsampled">
                {field => (
                  <field.Layout.Stack label="Spans Downsampled">
                    <field.Select
                      value={field.state.value}
                      onChange={field.handleChange}
                      options={getRetentionOptions(
                        subscription.categories.spans?.retention?.downsampled ?? null
                      )}
                      placeholder="Plan default"
                      clearable
                    />
                  </field.Layout.Stack>
                )}
              </form.AppField>
            </Fragment>
          )}
        </Stack>
      </Body>
      <Footer>
        <Button onClick={closeModal}>Cancel</Button>
        <form.SubmitButton>Update Settings</form.SubmitButton>
      </Footer>
    </form.AppForm>
  );
}

type Options = Pick<Props, 'onSuccess' | 'organization' | 'subscription'>;

export const openUpdateRetentionSettingsModal = (opts: Options) =>
  openModal(deps => <UpdateRetentionSettingsModal {...deps} {...opts} />, {
    closeEvents: 'escape-key',
  });
