import {Fragment} from 'react';
import {useMutation} from '@tanstack/react-query';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Stack} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useNavigate} from 'sentry/utils/useNavigate';

import type {PromoCode} from 'admin/types';

type Props = ModalRenderProps & {
  onSubmit?: (promoCode: PromoCode) => void;
  promoCode?: PromoCode;
};

const promoCodeSchema = z.object({
  code: z.string().min(5, 'Code must be at least 5 characters'),
  campaign: z.string(),
  isTrialPromo: z.boolean(),
  duration: z.string(),
  amount: z.string(),
  trialDays: z.string(),
  maxClaims: z.string().min(1, 'Max claims is required'),
  newOnly: z.boolean(),
  setExpiration: z.boolean(),
  dateExpires: z.string(),
});

const durationOptions = Array.from({length: 12}, (_, index) => ({
  value: String(index + 1),
  label: index === 0 ? 'Once' : `${index + 1} Months`,
}));

export function AddPromoCodeModal({
  Body,
  Header,
  Footer,
  promoCode,
  onSubmit,
  closeModal,
}: Props) {
  const navigate = useNavigate();
  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof promoCodeSchema>) =>
      fetchMutation<PromoCode>({
        url: promoCode
          ? getApiUrl('/promocodes/$code/', {path: {code: promoCode.code}})
          : getApiUrl('/promocodes/'),
        method: promoCode ? 'PUT' : 'POST',
        data: values,
      }),
    onSuccess: newCode => {
      onSubmit?.(newCode);
      if (promoCode) {
        closeModal();
      } else {
        navigate(`/_admin/promocodes/${newCode.code}/`);
      }
    },
    onError: error => {
      const detail =
        error instanceof RequestError ? error.responseJSON?.detail : undefined;
      addErrorMessage(typeof detail === 'string' ? detail : 'Unable to save promo code.');
    },
  });
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      code: promoCode?.code ?? '',
      campaign: promoCode?.campaign ?? '',
      isTrialPromo: false,
      duration: promoCode?.duration ?? '1',
      amount: promoCode?.amount ?? '',
      trialDays: String(promoCode?.trialDays ?? ''),
      maxClaims: String(promoCode?.maxClaims ?? ''),
      newOnly: promoCode?.newOnly ?? false,
      setExpiration: Boolean(promoCode?.dateExpires),
      dateExpires: promoCode?.dateExpires?.slice(0, 16) ?? '',
    },
    validators: {onDynamic: promoCodeSchema},
    onSubmit: ({value}) => mutation.mutateAsync(value).catch(() => {}),
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
          <form.AppField name="code">
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
                <form.AppField name="trialDays">
                  {field => (
                    <field.Layout.Stack label="Trial Days">
                      <field.Input
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
                  <form.AppField name="amount">
                    {field => (
                      <field.Layout.Stack label="Amount">
                        <field.Input
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
                hintText="The maximum number of accounts which can claim this code."
                required
              >
                <field.Input value={field.state.value} onChange={field.handleChange} />
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
        <Button onClick={closeModal}>Cancel</Button>
        <form.SubmitButton>{promoCode ? 'Update' : 'Create'}</form.SubmitButton>
      </Footer>
    </form.AppForm>
  );
}
