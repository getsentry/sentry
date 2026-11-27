import upperFirst from 'lodash/upperFirst';
import moment from 'moment-timezone';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import type {AdminActionModalProps} from 'admin/components/adminConfirmationModal';
import {
  AdminAuditFields,
  adminAuditDefaults,
  adminAuditParams,
  adminAuditSchema,
} from 'admin/components/adminConfirmationModal';
import type {ProductTrial} from 'getsentry/types';

type Props = AdminActionModalProps & {
  activeProductTrial: ProductTrial;
  apiName: string;
  trialName: string;
};

const schema = z.object({
  extendDays: z
    .number({error: 'Enter a number of days between 1 and 180'})
    .int()
    .min(1, 'Extend by at least 1 day')
    .max(180, 'Extend by at most 180 days'),
  audit: adminAuditSchema,
});

const defaultValues: {audit: typeof adminAuditDefaults; extendDays: number | null} = {
  extendDays: 14,
  audit: adminAuditDefaults,
};

/**
 * Modal for extending a product trial
 */
export function ExtendProductTrialAction({
  Header,
  Body,
  Footer,
  closeModal,
  header,
  onConfirm,
  activeProductTrial,
  apiName,
  trialName,
}: Props) {
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues,
    validators: {onDynamic: schema},
    onSubmit: ({value}) => {
      onConfirm({
        [`extendTrial${upperFirst(apiName)}`]: true,
        extendTrialDays: value.extendDays,
        ...adminAuditParams(value.audit),
      });
      closeModal();
    },
  });

  const currentEndDate = moment.utc(activeProductTrial.endDate);

  return (
    <form.AppForm form={form}>
      {header && <Header>{header}</Header>}
      <Body>
        <Stack gap="lg">
          <Text as="p">
            Extend the <Text bold>{trialName}</Text> product trial.
          </Text>
          <Text as="p">
            Current trial ends:{' '}
            <Text bold>{currentEndDate.format('MMMM Do YYYY')} UTC</Text>
          </Text>
          <form.AppField name="extendDays">
            {field => (
              <field.Layout.Stack
                label="Number of Days to Extend"
                hintText={`New trial end date: ${currentEndDate
                  .clone()
                  .add(field.state.value ?? 0, 'days')
                  .format('MMMM Do YYYY')} UTC`}
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
          <AdminAuditFields form={form} fields="audit" />
        </Stack>
      </Body>
      <Footer>
        <Flex align="center" gap="xl">
          <Button onClick={closeModal}>Cancel</Button>
          <form.SubmitButton>Extend Trial</form.SubmitButton>
        </Flex>
      </Footer>
    </form.AppForm>
  );
}
