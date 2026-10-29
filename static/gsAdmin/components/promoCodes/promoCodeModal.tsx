import {Fragment} from 'react';
import {useMutation} from '@tanstack/react-query';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, setFieldErrors, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';
import {toast} from '@sentry/scraps/toast';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {requestErrorToFieldErrors} from 'sentry/utils/requestError/requestErrorToFieldErrors';
import {useNavigate} from 'sentry/utils/useNavigate';

import type {PromoCode} from 'admin/types';

type Props = ModalRenderProps & {
  onSubmit?: (promoCode: PromoCode) => void;
  promoCode?: PromoCode;
};

const promoCodeSchema = z.object({
  isBatch: z.boolean(),
  code: z.string(),
  codePrefix: z.string(),
  count: z.number().nullable(),
  campaign: z.string(),
  isTrialPromo: z.boolean(),
  duration: z.string(),
  amount: z.number().nullable(),
  trialDays: z.number().nullable(),
  maxClaims: z
    .number()
    .int('Max claims must be a whole number')
    .positive('Max claims must be greater than zero')
    .nullable()
    .refine(value => value !== null, 'Max claims is required'),
  newOnly: z.boolean(),
  setExpiration: z.boolean(),
  dateExpires: z.string(),
});

const apiDurationValues = [
  'once',
  'twice',
  'three_times',
  'four_times',
  'five_times',
  'six_times',
  'seven_times',
  'eight_times',
  'nine_times',
  'ten_times',
  'eleven_times',
  'twelve_times',
];

const MAX_BATCH_COUNT = 5000;

const codePattern = /^[\w-]+$/;

const durationOptions = apiDurationValues.map((_, index) => ({
  value: String(index + 1),
  label: index === 0 ? 'Once' : `${index + 1} Months`,
}));

function downloadCodesCsv(promoCodes: PromoCode[], prefix: string) {
  const csv = ['code', ...promoCodes.map(promoCode => promoCode.code)].join('\n');
  const blob = new Blob([csv], {type: 'text/csv'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `promo-codes-${prefix}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function AddPromoCodeModal({
  Body,
  Header,
  Footer,
  promoCode,
  onSubmit,
  closeModal,
}: Props) {
  const navigate = useNavigate();
  const savedDurationIndex = apiDurationValues.indexOf(promoCode?.duration ?? '');
  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof promoCodeSchema>) => {
      const {
        amount,
        trialDays,
        duration,
        isTrialPromo,
        setExpiration,
        isBatch,
        code,
        codePrefix,
        count,
        ...otherValues
      } = values;
      return fetchMutation<PromoCode | PromoCode[]>({
        url: promoCode
          ? getApiUrl('/promocodes/$code/', {path: {code: promoCode.code}})
          : getApiUrl('/promocodes/'),
        method: promoCode ? 'PUT' : 'POST',
        data: {
          ...otherValues,
          ...(isBatch ? {codePrefix, count: String(count)} : {code}),
          ...(promoCode ? (isTrialPromo ? {amount: null} : {trialDays: null}) : {}),
          ...(isTrialPromo ? {trialDays: String(trialDays)} : {amount: String(amount)}),
          ...(!isTrialPromo && {duration}),
          maxClaims: String(values.maxClaims),
          dateExpires: setExpiration && values.dateExpires ? values.dateExpires : null,
        },
      });
    },
    onSuccess: (result, values) => {
      if (Array.isArray(result)) {
        downloadCodesCsv(result, values.codePrefix);
        toast.success(`Created ${result.length} promo codes.`);
        closeModal();
        return;
      }
      onSubmit?.(result);
      if (promoCode) {
        closeModal();
      } else {
        navigate(`/_admin/promocodes/${result.code}/`);
      }
    },
    onError: error => {
      if (error instanceof RequestError) {
        const hasFieldErrors = setFieldErrors(
          form,
          requestErrorToFieldErrors(error, form.state.values)
        );
        const response = error.responseJSON;
        const nonFieldErrors = response?.non_field_errors ?? response?.nonFieldErrors;
        if (Array.isArray(nonFieldErrors) && nonFieldErrors.length > 0) {
          toast.error(nonFieldErrors.join(' '));
          return;
        }
        if (hasFieldErrors) {
          return;
        }
        if (typeof response?.detail === 'string') {
          toast.error(response.detail);
          return;
        }
      }
      toast.error('Unable to save promo code.');
    },
  });
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      isBatch: false,
      code: promoCode?.code ?? '',
      codePrefix: '',
      count: null as number | null,
      campaign: promoCode?.campaign ?? '',
      isTrialPromo: Boolean(promoCode?.trialDays),
      duration:
        savedDurationIndex === -1
          ? (promoCode?.duration ?? '1')
          : String(savedDurationIndex + 1),
      amount: promoCode?.amount ? Number(promoCode.amount) : null,
      trialDays: promoCode?.trialDays || null,
      maxClaims: promoCode?.maxClaims ?? null,
      newOnly: promoCode?.newOnly ?? false,
      setExpiration: Boolean(promoCode?.dateExpires),
      dateExpires: promoCode?.dateExpires?.slice(0, 16) ?? '',
    },
    validators: {onDynamic: promoCodeSchema},
    onSubmit: ({value}) =>
      mutation.mutateAsync(promoCodeSchema.parse(value)).catch(() => {}),
  });

  return (
    <form.AppForm form={form}>
      <Header closeButton>
        <Heading as="h4">
          {promoCode ? `Edit ${promoCode.code}` : 'Add New Promo Code'}
        </Heading>
      </Header>
      <Body>
        <Stack gap="lg">
          {!promoCode && (
            <form.AppField name="isBatch">
              {field => (
                <field.Layout.Row label="Create a batch of codes?">
                  <field.Switch
                    checked={field.state.value}
                    onChange={field.handleChange}
                  />
                </field.Layout.Row>
              )}
            </form.AppField>
          )}
          <form.Subscribe selector={state => state.values.isBatch}>
            {isBatch =>
              isBatch ? (
                <Fragment>
                  <form.AppField
                    name="codePrefix"
                    validators={{
                      onDynamic: z
                        .string()
                        .min(1, 'Code prefix is required')
                        .max(32, 'Code prefix must be at most 32 characters')
                        .regex(
                          codePattern,
                          'Only letters, numbers, hyphens, and underscores are allowed'
                        ),
                    }}
                  >
                    {field => (
                      <field.Layout.Stack
                        label="Code Prefix"
                        hintText="Each code is this prefix followed by 8 random letters and numbers. Alphanumeric, hyphens, and underscores allowed."
                        required
                      >
                        <field.Input
                          value={field.state.value}
                          onChange={field.handleChange}
                          placeholder="e.g. PYCON-"
                        />
                      </field.Layout.Stack>
                    )}
                  </form.AppField>
                  <form.AppField
                    name="count"
                    validators={{
                      onDynamic: z
                        .number()
                        .int('Count must be a whole number')
                        .min(1, 'Count must be at least 1')
                        .max(MAX_BATCH_COUNT, `Count must be at most ${MAX_BATCH_COUNT}`)
                        .nullable()
                        .refine(value => value !== null, 'Count is required'),
                    }}
                  >
                    {field => (
                      <field.Layout.Stack
                        label="Count"
                        hintText={`How many codes to create, up to ${MAX_BATCH_COUNT}. A CSV of the codes downloads once they are created.`}
                        required
                      >
                        <field.Number
                          min={1}
                          max={MAX_BATCH_COUNT}
                          step={1}
                          value={field.state.value}
                          onChange={field.handleChange}
                        />
                      </field.Layout.Stack>
                    )}
                  </form.AppField>
                </Fragment>
              ) : (
                <form.AppField
                  name="code"
                  validators={{
                    onDynamic: z.string().min(5, 'Code must be at least 5 characters'),
                  }}
                >
                  {field => (
                    <field.Layout.Stack
                      label="Code (ID)"
                      hintText="A unique identifier for this promo code. Case-insensitive. Alphanumeric, hyphens, and underscores allowed. Must be at least 5 characters."
                      required
                    >
                      <field.Input
                        value={field.state.value}
                        onChange={field.handleChange}
                        disabled={!!promoCode}
                        placeholder="e.g. mysecretcode79"
                      />
                    </field.Layout.Stack>
                  )}
                </form.AppField>
              )
            }
          </form.Subscribe>
          <form.AppField name="campaign">
            {field => (
              <field.Layout.Stack
                label="Campaign"
                hintText="An optional campaign identifier for this promo code."
              >
                <field.Input
                  value={field.state.value}
                  onChange={field.handleChange}
                  placeholder="e.g. pycon"
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="isTrialPromo">
            {field => (
              <field.Layout.Row label="Create trial promo code?">
                <field.Switch checked={field.state.value} onChange={field.handleChange} />
              </field.Layout.Row>
            )}
          </form.AppField>
          <form.Subscribe selector={state => state.values.isTrialPromo}>
            {isTrialPromo =>
              isTrialPromo ? (
                <form.AppField
                  name="trialDays"
                  validators={{
                    onDynamic: z
                      .number()
                      .int('Trial Days must be a positive whole number')
                      .positive('Trial Days must be a positive whole number')
                      .nullable()
                      .refine(value => value !== null, 'Trial Days is required'),
                  }}
                >
                  {field => (
                    <field.Layout.Stack label="Trial Days" required>
                      <field.Number
                        min={1}
                        step={1}
                        value={field.state.value}
                        onChange={field.handleChange}
                        placeholder="e.g. 30"
                      />
                    </field.Layout.Stack>
                  )}
                </form.AppField>
              ) : (
                <Fragment>
                  <form.AppField name="duration">
                    {field => (
                      <field.Layout.Stack
                        label="Duration"
                        hintText="How many times will this promo be applied to their account?"
                        required
                      >
                        <field.Select
                          value={field.state.value}
                          onChange={field.handleChange}
                          options={durationOptions}
                        />
                      </field.Layout.Stack>
                    )}
                  </form.AppField>
                  <form.AppField
                    name="amount"
                    validators={{
                      onDynamic: z
                        .number()
                        .positive('Amount must be greater than zero')
                        .nullable()
                        .refine(value => value !== null, 'Amount is required'),
                    }}
                  >
                    {field => (
                      <field.Layout.Stack label="Amount" required>
                        <field.Number
                          step="any"
                          value={field.state.value}
                          onChange={field.handleChange}
                          placeholder="e.g. 29 or 99.99"
                        />
                      </field.Layout.Stack>
                    )}
                  </form.AppField>
                </Fragment>
              )
            }
          </form.Subscribe>
          <form.AppField name="maxClaims">
            {field => (
              <field.Layout.Stack
                label="Max claims"
                hintText="The maximum number of accounts which can claim each code."
                required
              >
                <field.Number
                  min={1}
                  step={1}
                  value={field.state.value}
                  onChange={field.handleChange}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="newOnly">
            {field => (
              <field.Layout.Row label="Only allow this code to be applied to new accounts.">
                <field.Switch checked={field.state.value} onChange={field.handleChange} />
              </field.Layout.Row>
            )}
          </form.AppField>
          <form.AppField name="setExpiration">
            {field => (
              <field.Layout.Row label="Set an expiration date for the promo code?">
                <field.Switch checked={field.state.value} onChange={field.handleChange} />
              </field.Layout.Row>
            )}
          </form.AppField>
          <form.Subscribe selector={state => state.values.setExpiration}>
            {setExpiration =>
              setExpiration && (
                <form.AppField name="dateExpires">
                  {field => (
                    <field.Layout.Stack
                      label="Date Expires"
                      hintText="Optional date the promotion will no longer be valid after."
                    >
                      <field.Input
                        type="datetime-local"
                        value={field.state.value}
                        onChange={field.handleChange}
                      />
                    </field.Layout.Stack>
                  )}
                </form.AppField>
              )
            }
          </form.Subscribe>
        </Stack>
      </Body>
      <Footer>
        <Flex gap="md" justify="end">
          <Button onClick={closeModal}>Cancel</Button>
          <form.SubmitButton>{promoCode ? 'Update' : 'Create'}</form.SubmitButton>
        </Flex>
      </Footer>
    </form.AppForm>
  );
}
