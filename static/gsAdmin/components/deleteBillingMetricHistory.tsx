import {Fragment} from 'react';
import {useMutation, useQuery} from '@tanstack/react-query';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';

type CategoryInfo = {
  api_name: string;
  billed_category: number;
  display_name: string;
  name: string;
  order: number;
  product_name: string;
  singular: string;
  tally_type: number;
};

type BillingConfig = {
  category_info: Record<string, CategoryInfo>;
  outcomes: Record<string, string>;
  reason_codes: Record<string, string>;
};

type Props = {
  onSuccess: () => void;
  organization: Organization;
};

type ModalProps = Props & ModalRenderProps;

const formSchema = z.object({
  dataCategory: z
    .number()
    .nullable()
    .refine(value => value !== null, 'Please select a data category.'),
});

const defaultValues: z.input<typeof formSchema> = {
  dataCategory: null,
};

function DeleteBillingMetricHistoryModal({
  onSuccess,
  organization,
  closeModal,
  Header,
  Body,
  Footer,
}: ModalProps) {
  const orgSlug = organization.slug;

  const {data: billingConfig = null, isPending: isLoadingBillingConfig} = useQuery(
    apiOptions.as<BillingConfig>()('/billing-config/', {
      staleTime: Infinity,
    })
  );

  const mutation = useMutation({
    mutationFn: (dataCategory: number) =>
      fetchMutation({
        url: `/api/0/customers/${orgSlug}/delete-billing-metric-history/`,
        method: 'POST',
        data: {data_category: dataCategory},
      }),
    onSuccess: () => {
      addSuccessMessage('Successfully deleted billing metric history.');
      closeModal();
      onSuccess();
    },
    onError: error => {
      const errorMsg =
        error instanceof RequestError && typeof error.responseJSON?.detail === 'string'
          ? error.responseJSON.detail
          : 'Unable to delete billing metric history.';
      addErrorMessage(errorMsg);
    },
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues,
    validators: {onDynamic: formSchema},
    onSubmit: ({value}) => {
      const data = formSchema.parse(value);
      return mutation.mutateAsync(data.dataCategory).catch(() => {});
    },
  });

  if (isLoadingBillingConfig || !billingConfig) {
    return (
      <Fragment>
        <Header closeButton>Delete Billing Metric History</Header>
        <Body>
          <LoadingIndicator />
        </Body>
      </Fragment>
    );
  }

  const dataCategoryOptions = Object.entries(billingConfig.category_info).map(
    ([key, value]) => {
      const billingMetric = Number(key);
      return {
        value: billingMetric,
        label: `${value.display_name} (${billingMetric})`,
      };
    }
  );

  return (
    <form.AppForm form={form}>
      <Header closeButton>Delete Billing Metric History</Header>
      <Body>
        <Stack gap="lg">
          <Text as="p">Delete billing metric history for a specific data category.</Text>
          <form.AppField name="dataCategory">
            {field => (
              <field.Layout.Stack
                label="Data Category"
                hintText="Warning: This action cannot be undone. The selected billing metric history will be permanently deleted."
                required
              >
                <field.Select
                  value={field.state.value}
                  onChange={field.handleChange}
                  options={dataCategoryOptions}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
        </Stack>
      </Body>
      <Footer>
        <Flex gap="md" justify="end">
          <Button onClick={closeModal}>Cancel</Button>
          <form.SubmitButton>Delete</form.SubmitButton>
        </Flex>
      </Footer>
    </form.AppForm>
  );
}

type Options = Pick<Props, 'onSuccess' | 'organization'>;

export const deleteBillingMetricHistory = (opts: Options) =>
  openModal(deps => <DeleteBillingMetricHistoryModal {...deps} {...opts} />, {
    closeEvents: 'escape-key',
  });
