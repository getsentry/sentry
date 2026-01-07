import {useState} from 'react';
import {PaymentElement, useElements, useStripe} from '@stripe/react-stripe-js';
import type {StripePaymentElementChangeEvent} from '@stripe/stripe-js';

import {Alert} from '@sentry/scraps/alert';

import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import {ExternalLink} from 'sentry/components/core/link';
import {Text} from 'sentry/components/core/text';
import Form from 'sentry/components/forms/form';
import {t, tct} from 'sentry/locale';
import {defined} from 'sentry/utils';

import type {InnerIntentFormProps} from 'getsentry/components/creditCardEdit/intentForms/types';

function InnerIntentForm({
  onCancel,
  onError,
  budgetTerm,
  buttonText,
  location,
  handleSubmit,
  isSubmitting,
  busyButtonText,
  errorMessage,
}: InnerIntentFormProps) {
  const elements = useElements();
  const stripe = useStripe();
  const [submitDisabled, setSubmitDisabled] = useState(true);

  // TODO(ISABELLA): this is the problem, formData is not complete
  const handleFormChange = (formData: StripePaymentElementChangeEvent) => {
    if (formData.complete) {
      setSubmitDisabled(false);
    } else {
      setSubmitDisabled(true);
    }
  };

  return (
    <Flex direction="column" gap="xl">
      {errorMessage && <Alert variant="danger">{errorMessage}</Alert>}
      <Form
        onSubmit={() => handleSubmit({stripe, elements})}
        onSubmitError={error =>
          onError(error.responseJSON?.detail ?? t('An unknown error occurred.'))
        }
        submitDisabled={submitDisabled}
        submitLabel={
          isSubmitting && busyButtonText
            ? busyButtonText
            : (buttonText ?? t('Save Changes'))
        }
        extraButton={
          onCancel && (
            <Button aria-label={t('Cancel')} onClick={onCancel}>
              {t('Cancel')}
            </Button>
          )
        }
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
          />
          <Flex direction="column" gap="sm">
            <small>
              {tct('Payments are processed securely through [stripe:Stripe].', {
                stripe: <ExternalLink href="https://stripe.com/" />,
              })}
            </small>
            {/* location is 0 on the checkout page which is why this isn't location && */}
            {defined(location) && (
              <Text size="xs" variant="muted">
                {tct(
                  'By clicking [buttonText], you authorize Sentry to automatically charge you recurring subscription fees and applicable [budgetTerm] fees. Recurring charges occur at the start of your selected billing cycle for subscription fees and monthly for [budgetTerm] fees. You may cancel your subscription at any time [here:here].',
                  {
                    buttonText: <b>{buttonText ?? t('Save Changes')}</b>,
                    budgetTerm,
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
    </Flex>
  );
}

export default InnerIntentForm;
