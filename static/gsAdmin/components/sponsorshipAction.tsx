import {Fragment, useEffect} from 'react';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';

import type {AdminConfirmRenderProps} from 'admin/components/adminConfirmationModal';
import {adminConfirmFormOptions} from 'admin/components/adminConfirmationModal';
import type {Subscription} from 'getsentry/types';

type Props = AdminConfirmRenderProps & {subscription: Subscription};

const REMOVE_SPONSORSHIP = 'remove';

const SPONSORED_TYPE_OPTIONS = [
  {value: 'education', label: 'Education'},
  {value: 'open_source', label: 'Open source'},
  {value: 'non_profit', label: 'Non-profit'},
  {value: 'employee', label: 'Employee'},
  {value: 'friends_and_family', label: 'Friends and family'},
];

const schema = z.object({
  sponsoredType: z
    .string()
    .nullable()
    .refine(value => value !== null, 'Choose a sponsored type'),
});

const defaultValues: z.input<typeof schema> = {sponsoredType: null};

/**
 * Rendered as part of a openAdminConfirmModal call
 */
export function SponsorshipAction({
  subscription,
  setConfirmCallback,
  disableConfirmButton,
  onConfirm,
}: Props) {
  const form = useScrapsForm({
    ...defaultFormOptions,
    ...adminConfirmFormOptions(schema, disableConfirmButton),
    defaultValues,
    validators: {onDynamic: schema},
    onSubmit: ({value}) => {
      onConfirm?.({
        sponsoredType:
          value.sponsoredType === REMOVE_SPONSORSHIP ? null : value.sponsoredType,
      });
    },
  });

  useEffect(() => {
    setConfirmCallback(params => form.handleSubmit(params));
  }, [setConfirmCallback, form]);

  const options = subscription.isSponsored
    ? [
        {value: REMOVE_SPONSORSHIP, label: 'None (remove sponsorship)'},
        ...SPONSORED_TYPE_OPTIONS,
      ]
    : SPONSORED_TYPE_OPTIONS;

  return (
    <Fragment>
      {subscription.isSponsored && (
        <Alert.Container>
          <Alert variant="info">This account is already sponsored.</Alert>
        </Alert.Container>
      )}
      <form.AppForm form={form}>
        <form.AppField name="sponsoredType">
          {field => (
            <Fragment>
              {field.state.value === REMOVE_SPONSORSHIP && (
                <Alert.Container>
                  <Alert variant="warning">
                    Removing the sponsorship takes effect immediately. The account keeps
                    its current plan and billing period, but the sponsorship's extra
                    quotas, along with any other custom reserved volumes or pay-as-you-go
                    budget, go back to the plan's defaults.
                  </Alert>
                </Alert.Container>
              )}
              <field.Layout.Stack label="Sponsored Type" required>
                <field.Select
                  options={options}
                  value={field.state.value}
                  onChange={field.handleChange}
                />
              </field.Layout.Stack>
            </Fragment>
          )}
        </form.AppField>
      </form.AppForm>
    </Fragment>
  );
}
