import {Fragment, useEffect} from 'react';
import upperFirst from 'lodash/upperFirst';
import moment from 'moment-timezone';
import {z} from 'zod';

import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';

import type {AdminConfirmRenderProps} from 'admin/components/adminConfirmationModal';
import {adminConfirmFormOptions} from 'admin/components/adminConfirmationModal';
import type {ProductTrial} from 'getsentry/types';

type Props = AdminConfirmRenderProps & {
  activeProductTrial: ProductTrial;
  apiName: string;
  trialName: string;
};

const schema = z.object({
  extendDays: z
    .number()
    .int()
    .min(1, 'Extend by at least 1 day')
    .max(180, 'Extend by at most 180 days')
    .nullable()
    .refine(value => value !== null, 'Enter a number of days between 1 and 180'),
});

const defaultValues: z.input<typeof schema> = {extendDays: 14};

/**
 * Rendered as part of an openAdminConfirmModal call for extending product trials
 */
export function ExtendProductTrialAction({
  activeProductTrial,
  apiName,
  trialName,
  onConfirm,
  setConfirmCallback,
  disableConfirmButton,
}: Props) {
  const form = useScrapsForm({
    ...defaultFormOptions,
    ...adminConfirmFormOptions(schema, disableConfirmButton),
    defaultValues,
    validators: {onDynamic: schema},
    onSubmit: ({value, meta}) => {
      onConfirm?.({
        [`extendTrial${upperFirst(apiName)}`]: true,
        extendTrialDays: value.extendDays,
        ...meta,
      });
    },
  });

  useEffect(() => {
    setConfirmCallback(params => form.handleSubmit(params));
  }, [setConfirmCallback, form]);

  const currentEndDate = moment.utc(activeProductTrial.endDate);

  return (
    <Fragment>
      <p>
        Extend the <strong>{trialName}</strong> product trial.
      </p>
      <p>
        Current trial ends: <strong>{currentEndDate.format('MMMM Do YYYY')} UTC</strong>
      </p>
      <form.AppForm form={form}>
        <form.AppField name="extendDays">
          {field => (
            <field.Layout.Stack
              label="Number of Days to Extend"
              hintText={
                <Fragment>
                  New trial end date:{' '}
                  <strong>
                    {currentEndDate
                      .clone()
                      .add(field.state.value ?? 0, 'days')
                      .format('MMMM Do YYYY')}{' '}
                    UTC
                  </strong>
                </Fragment>
              }
            >
              <field.Number
                min={1}
                max={180}
                value={field.state.value}
                onChange={field.handleChange}
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
      </form.AppForm>
    </Fragment>
  );
}
