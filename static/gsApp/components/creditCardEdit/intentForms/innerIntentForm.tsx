import {useCallback, useEffect, useRef, useState, type FormEvent} from 'react';
import {PaymentElement, useElements, useStripe} from '@stripe/react-stripe-js';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t, tct} from 'sentry/locale';
import {defined} from 'sentry/utils/defined';

import type {InnerIntentFormProps} from 'getsentry/components/creditCardEdit/intentForms/types';

export function InnerIntentForm({
  onCancel,
  onError,
  budgetTerm,
  buttonText,
  location,
  handleSubmit,
  isSubmitting,
  errorMessage,
}: InnerIntentFormProps) {
  const elements = useElements();
  const stripe = useStripe();
  const [stripeIsLoading, setStripeIsLoading] = useState(true);
  const [stripeIsBlocked, setStripeIsBlocked] = useState(false);
  const submittingRef = useRef(false);
  const [isHandlingSubmit, setIsHandlingSubmit] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting || stripeIsBlocked || submittingRef.current) {
      return;
    }
    submittingRef.current = true;
    setIsHandlingSubmit(true);
    try {
      await handleSubmit({stripe, elements});
    } catch (error) {
      onError?.(error instanceof Error ? error.message : t('An unknown error occurred.'));
    } finally {
      submittingRef.current = false;
      setIsHandlingSubmit(false);
    }
  };

  const handleStripeLoadError = useCallback(() => {
    setStripeIsBlocked(true);
    setStripeIsLoading(false);
  }, []);

  // Check if Stripe loaded properly
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (!stripe || !elements) {
        handleStripeLoadError();
      }
      setStripeIsLoading(false);
    }, 10000); // 10 second timeout

    return () => clearTimeout(timeoutId);
  }, [stripe, elements, handleStripeLoadError]);

  return (
    <Stack gap="xl">
      {stripeIsBlocked && (
        <Alert variant="warning">
          {t(
            'To add or update your payment method, you may need to disable any ad or tracker blocking extensions on this page and reload.'
          )}
        </Alert>
      )}
      {errorMessage && <Alert variant="danger">{errorMessage}</Alert>}
      <form onSubmit={submit}>
        <Stack gap="xl">
          <Stack gap="xl">
            {stripeIsLoading && <LoadingIndicator />}
            <PaymentElement
              onReady={() => setStripeIsLoading(false)}
              onLoadError={() => {
                handleStripeLoadError();
              }}
              options={{
                terms: {card: 'never'}, // we display the terms ourselves
                wallets: {applePay: 'never', googlePay: 'never'},
              }}
            />
            <Stack gap="sm">
              <Text as="p" size="sm">
                {tct('Payments are processed securely through [stripe:Stripe].', {
                  stripe: <ExternalLink href="https://stripe.com/" />,
                })}
              </Text>
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
            </Stack>
          </Stack>
          <Flex
            align="center"
            justify="end"
            gap="md"
            borderTop="secondary"
            paddingTop="lg"
          >
            {onCancel && <Button onClick={onCancel}>{t('Cancel')}</Button>}
            <Button
              type="submit"
              variant="primary"
              busy={isSubmitting || isHandlingSubmit}
              disabled={isSubmitting || isHandlingSubmit || stripeIsBlocked}
            >
              {buttonText ?? t('Save Changes')}
            </Button>
          </Flex>
        </Stack>
      </form>
    </Stack>
  );
}
