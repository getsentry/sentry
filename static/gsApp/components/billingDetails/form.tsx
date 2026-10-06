import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import {AddressElement, useElements, useStripe} from '@stripe/react-stripe-js';
import type {StripeAddressElementChangeEvent} from '@stripe/stripe-js';
import {useMutation} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {defaultFormOptions, setFieldErrors, useScrapsForm} from '@sentry/scraps/form';
import {InfoTip} from '@sentry/scraps/info';
import {Input} from '@sentry/scraps/input';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t, tct} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';
import type {Organization} from 'sentry/types/organization';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {defined} from 'sentry/utils/defined';
import {fetchMutation} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useLocation} from 'sentry/utils/useLocation';

import {StripeWrapper} from 'getsentry/components/stripeWrapper';
import type {BillingDetails} from 'getsentry/types';
import {countryCodes} from 'getsentry/utils/ISO3166codes';
import type {TaxFieldInfo} from 'getsentry/utils/salesTax';
import {
  countryHasRegionChoices,
  countryHasSalesTax,
  getRegionChoiceCode,
  getTaxFieldInfo,
} from 'getsentry/utils/salesTax';
import type {GetsentryEventKey} from 'getsentry/utils/trackGetsentryAnalytics';
import {trackGetsentryAnalytics} from 'getsentry/utils/trackGetsentryAnalytics';

const COUNTRY_CODE_CHOICES = countryCodes.map(({name, code}) => [code, name]);

type Props = {
  onSubmitSuccess: (data: Record<PropertyKey, unknown>) => void;
  organization: Organization;
  /**
   * Analytics event to track on form submission.
   */
  analyticsEvent?: GetsentryEventKey;
  /**
   * Extra button to render in the form footer.
   */
  extraButton?: React.ReactNode;
  /**
   * Initial form data.
   */
  initialData?: BillingDetails;
  onSubmitError?: (error: any) => void;
};

type State = {
  showTaxNumber: boolean;
  countryCode?: string | null;
  taxFieldInfo?: TaxFieldInfo;
};

const GOOGLE_MAPS_API_KEY = ConfigStore.get('getsentry.googleMapsApiKey');

function BillingDetailsFormFields({
  billingEmail,
  taxNumber,
  onBillingEmailChange,
  onTaxNumberChange,
  initialData,
  handleStripeFormChange,
  state,
  taxFieldInfo,
  onSubmitDisabled,
}: {
  billingEmail: string;
  handleStripeFormChange: (data: StripeAddressElementChangeEvent) => void;
  onBillingEmailChange: (value: string) => void;
  onSubmitDisabled: (disabled: boolean) => void;
  onTaxNumberChange: (value: string) => void;
  state: State;
  taxNumber: string;
  initialData?: BillingDetails;
  taxFieldInfo?: TaxFieldInfo;
}) {
  const elements = useElements();
  const stripe = useStripe();
  const [stripeIsLoading, setStripeIsLoading] = useState(true); // stripe is loading
  const [stripeIsBlocked, setStripeIsBlocked] = useState(false); // stripe failed to load

  const handleStripeLoadError = useCallback(() => {
    setStripeIsBlocked(true);
    onSubmitDisabled(true);
    setStripeIsLoading(false);
  }, [onSubmitDisabled]);

  const handleStripeLoadSuccess = useCallback(() => {
    onSubmitDisabled(false);
    setStripeIsLoading(false);
  }, [onSubmitDisabled]);

  // Check if Stripe loaded properly
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (!stripe || !elements) {
        handleStripeLoadError();
      } else {
        handleStripeLoadSuccess();
      }
    }, 10000); // 10 second timeout

    return () => clearTimeout(timeoutId);
  }, [stripe, elements, handleStripeLoadError, handleStripeLoadSuccess]);

  return (
    <Stack gap="xl">
      {stripeIsBlocked ? (
        <Alert variant="warning">
          {t(
            'To add or update your business address, you may need to disable any ad or tracker blocking extensions on this page and reload.'
          )}
        </Alert>
      ) : (
        <Fragment>
          {!stripeIsLoading && (
            <CustomBillingDetailsFormField
              inputName="billingEmail"
              label={t('Billing email')}
              help={t(
                'If provided, all billing-related notifications will be sent to this address'
              )}
              placeholder={t('name@example.com (optional)')}
              value={billingEmail}
              onChange={onBillingEmailChange}
            />
          )}
          {stripeIsLoading && <LoadingIndicator />}
          <AddressElement
            options={{
              mode: 'billing',
              autocomplete: GOOGLE_MAPS_API_KEY
                ? {
                    mode: 'google_maps_api',
                    apiKey: GOOGLE_MAPS_API_KEY,
                  }
                : {
                    mode: 'automatic', // if our key isn't available, see if we can use Stripe's
                  },
              allowedCountries: COUNTRY_CODE_CHOICES.filter(([code]) =>
                defined(code)
              ).map(([code]) => code!),
              fields: {phone: 'never'}, // don't show phone number field
              defaultValues: {
                name: initialData?.companyName,
                address: {
                  line1: initialData?.addressLine1,
                  line2: initialData?.addressLine2,
                  city: initialData?.city,
                  state: initialData?.region,
                  postal_code: initialData?.postalCode,
                  country: initialData?.countryCode ?? 'US',
                },
              },
              display: {name: 'organization'},
            }}
            onChange={handleStripeFormChange}
            onReady={() => {
              handleStripeLoadSuccess();
            }}
            onLoadError={() => {
              handleStripeLoadError();
            }}
          />
          {!!(state.showTaxNumber && taxFieldInfo && !stripeIsLoading) && (
            // TODO: use Stripe's TaxIdElement when it's generally available
            <CustomBillingDetailsFormField
              inputName="taxNumber"
              label={taxFieldInfo.label}
              help={tct(
                "Your company's [taxNumberName] will appear on all receipts. You may be subject to taxes depending on country specific tax policies.",
                {taxNumberName: <strong>{taxFieldInfo.taxNumberName}</strong>}
              )}
              value={taxNumber}
              onChange={onTaxNumberChange}
              placeholder={taxFieldInfo.placeholder}
            />
          )}
        </Fragment>
      )}
    </Stack>
  );
}

function CustomBillingDetailsFormField({
  inputName,
  label,
  help,
  placeholder,
  value,
  onChange,
}: {
  inputName: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
  help?: React.ReactNode;
  placeholder?: string;
}) {
  return (
    <Stack gap="xs">
      <Flex align="center" gap="xs">
        <Text size="sm" variant="muted">
          {label}
        </Text>
        <InfoTip title={help} size="sm" />
      </Flex>
      <Input
        name={inputName}
        placeholder={placeholder}
        value={value}
        aria-label={label}
        onChange={event => onChange(event.target.value)}
      />
    </Stack>
  );
}

/**
 * Billing details form to be rendered inside a panel. This is
 * used in checkout, legal & compliance, and subscription settings.
 */
export function BillingDetailsForm({
  initialData,
  onSubmitError,
  onSubmitSuccess,
  organization,
  extraButton,
  analyticsEvent,
}: Props) {
  const [submitDisabled, setSubmitDisabled] = useState(true);
  const [state, setState] = useState<State>({
    countryCode: initialData?.countryCode,
    showTaxNumber:
      !!initialData?.taxNumber || countryHasSalesTax(initialData?.countryCode),
  });
  const location = useLocation();
  const taxFieldInfo = useMemo(
    () => getTaxFieldInfo(state.countryCode),
    [state.countryCode]
  );

  const mutation = useMutation({
    mutationFn: (values: Partial<BillingDetails>) => {
      const data = {...values};
      if (!countryHasSalesTax(data.countryCode)) {
        data.taxNumber = null;
      }
      if (!getRegionChoiceCode(data.countryCode, data.region)) {
        data.region = null;
      }
      return fetchMutation<BillingDetails>({
        url: getApiUrl('/customers/$organizationIdOrSlug/billing-details/', {
          path: {organizationIdOrSlug: organization.slug},
        }),
        method: 'PUT',
        data,
      });
    },
    onSuccess: data => {
      if (analyticsEvent) {
        trackGetsentryAnalytics(analyticsEvent, {
          organization,
          isStripeComponent: true,
          referrer: decodeScalar(location.query?.referrer),
        });
      }
      onSubmitSuccess(data);
    },
    onError: error => {
      onSubmitError?.(error);
      if (!onSubmitError) {
        const detail =
          error instanceof RequestError ? error.responseJSON?.detail : undefined;
        addErrorMessage(
          typeof detail === 'string' ? detail : t('Unable to save billing details.')
        );
      }
    },
  });
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      billingEmail: initialData?.billingEmail ?? '',
      taxNumber: initialData?.taxNumber ?? '',
      companyName: initialData?.companyName ?? null,
      addressLine1: initialData?.addressLine1 ?? null,
      addressLine2: initialData?.addressLine2 ?? null,
      city: initialData?.city ?? null,
      countryCode: initialData?.countryCode ?? null,
      region: countryHasRegionChoices(initialData?.countryCode)
        ? getRegionChoiceCode(initialData?.countryCode, initialData?.region)
        : (initialData?.region ?? null),
      postalCode: initialData?.postalCode ?? null,
    },
    onSubmit: ({value}) => {
      if (!value.addressLine1 || !value.countryCode) {
        setFieldErrors(form, {
          ...(value.addressLine1 ? {} : {addressLine1: {message: 'Address is required'}}),
          ...(value.countryCode ? {} : {countryCode: {message: 'Country is required'}}),
        });
        return;
      }
      return mutation.mutateAsync(value).catch(() => {});
    },
  });

  const handleStripeFormChange = (data: StripeAddressElementChangeEvent) => {
    form.setFieldValue('companyName', data.value.name);
    form.setFieldValue('addressLine1', data.value.address.line1);
    form.setFieldValue('addressLine2', data.value.address.line2);
    form.setFieldValue('city', data.value.address.city);
    form.setFieldValue('region', data.value.address.state);
    form.setFieldValue('countryCode', data.value.address.country);
    form.setFieldValue('postalCode', data.value.address.postal_code);
    const countryCode = data.value.address.country ?? '';
    setState({countryCode, showTaxNumber: countryHasSalesTax(countryCode)});
  };

  if (!organization.access.includes('org:billing')) {
    return null;
  }

  return (
    <StripeWrapper>
      <form.AppForm form={form}>
        <form.Subscribe selector={formState => formState.values}>
          {values => (
            <BillingDetailsFormFields
              billingEmail={values.billingEmail}
              taxNumber={values.taxNumber}
              onBillingEmailChange={value => form.setFieldValue('billingEmail', value)}
              onTaxNumberChange={value => form.setFieldValue('taxNumber', value)}
              initialData={initialData}
              handleStripeFormChange={handleStripeFormChange}
              state={state}
              taxFieldInfo={taxFieldInfo}
              onSubmitDisabled={setSubmitDisabled}
            />
          )}
        </form.Subscribe>
        <Flex align="center" justify="between" marginTop="lg">
          {extraButton}
          <form.SubmitButton disabled={submitDisabled}>Save Changes</form.SubmitButton>
        </Flex>
      </form.AppForm>
    </StripeWrapper>
  );
}
