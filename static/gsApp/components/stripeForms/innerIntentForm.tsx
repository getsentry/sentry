import {useState} from 'react';
import {PaymentElement, useElements, useStripe} from '@stripe/react-stripe-js';
import type {StripePaymentElementChangeEvent} from '@stripe/stripe-js';

import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import {ExternalLink} from 'sentry/components/core/link';
import {Text} from 'sentry/components/core/text';
import Form from 'sentry/components/forms/form';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t, tct} from 'sentry/locale';

import type {InnerIntentFormProps} from 'getsentry/components/stripeForms/types';

function InnerIntentForm({
  onCancel,
  budgetModeText,
  buttonText,
  location,
  handleSubmit,
}: InnerIntentFormProps) {
  const [loading, setLoading] = useState(false);
  const elements = useElements();
  const stripe = useStripe();
  const [submitDisabled, setSubmitDisabled] = useState(false);

  if (loading) {
    return <LoadingIndicator />;
  }

  const handleFormChange = (formData: StripePaymentElementChangeEvent) => {
    if (formData.complete) {
      setSubmitDisabled(false);
    } else {
      setSubmitDisabled(true);
    }
  };

  return (
    <Form
      onSubmit={() => handleSubmit({stripe, elements})}
      submitDisabled={submitDisabled}
      submitLabel={buttonText}
      extraButton={<Button onClick={onCancel}>{t('Cancel')}</Button>}
      footerStyle={{
        display: 'flex',
        justifyContent: 'space-between',
        marginLeft: 0,
      }}
    >
      <Flex direction="column" gap="xl">
        <PaymentElement
          onChange={handleFormChange}
          options={{
            terms: {card: 'never'}, // we display the terms ourselves
            wallets: {applePay: 'never', googlePay: 'never'},
          }}
          onReady={() => setLoading(false)}
        />
        <Flex direction="column" gap="sm">
          <small>
            {tct('Payments are processed securely through [stripe:Stripe].', {
              stripe: <ExternalLink href="https://stripe.com/" />,
            })}
          </small>
          {/* location is 0 on the checkout page which is why this isn't location && */}
          {location !== null && location !== undefined && (
            <Text size="xs" variant="muted">
              {tct(
                'By clicking [buttonText], you authorize Sentry to automatically charge you recurring subscription fees and applicable [budgetModeText] fees. Recurring charges occur at the start of your selected billing cycle for subscription fees and monthly for [budgetModeText] fees. You may cancel your subscription at any time [here:here].',
                {
                  buttonText: <b>{buttonText}</b>,
                  budgetModeText,
                  here: (
                    <ExternalLink href="https://sentry.io/settings/billing/cancel/" />
                  ),
                }
              )}
            </Text>
          )}
        </Flex>
      </Flex>
    </Form>
  );
}

export default InnerIntentForm;
