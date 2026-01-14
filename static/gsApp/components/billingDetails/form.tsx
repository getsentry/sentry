import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {AddressElement, useElements, useStripe} from '@stripe/react-stripe-js';
import type {StripeAddressElementChangeEvent} from '@stripe/stripe-js';

import {Alert} from '@sentry/scraps/alert';

import {Flex} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import type {FieldGroupProps} from 'sentry/components/forms/fieldGroup/types';
import TextField from 'sentry/components/forms/fields/textField';
import Form from 'sentry/components/forms/form';
import FormModel from 'sentry/components/forms/model';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';

import StripeWrapper from 'getsentry/components/stripeWrapper';
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
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';

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
   * Additional form field props for custom components.
   */
  fieldProps?: FieldGroupProps;
  /**
   * Custom styles for the form footer.
   */
  footerStyle?: React.CSSProperties;
  /**
   * Initial form data.
   */
  initialData?: BillingDetails;
  /**
   * Display detailed view for subscription settings.
   */
  isDetailed?: boolean;
  onPreSubmit?: () => void;
  onSubmitError?: (error: any) => void;
  /**
   * Are changes required before the form can be submitted?
   */
  requireChanges?: boolean;
  /**
   * Form submit button label.
   */
  submitLabel?: string;
};

type State = {
  showTaxNumber: boolean;
  countryCode?: string | null;
  taxFieldInfo?: TaxFieldInfo;
};

const GOOGLE_MAPS_API_KEY = ConfigStore.get('getsentry.googleMapsApiKey');

function BillingDetailsFormFields({
  form,
  isDetailed,
  fieldProps,
  initialData,
  handleStripeFormChange,
  state,
  taxFieldInfo,
  onSubmitDisabled,
}: {
  form: FormModel;
  handleStripeFormChange: (data: StripeAddressElementChangeEvent) => void;
  isDetailed: boolean;
  onSubmitDisabled: (disabled: boolean) => void;
  state: State;
  fieldProps?: FieldGroupProps;
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
    <Flex direction="column" gap="xl">
      {stripeIsBlocked ? (
        <Alert variant="warning">
          {t(
            'To add or update your business address, you may need to disable any ad or tracker blocking extensions on this page and reload.'
          )}
        </Alert>
      ) : (
        <Fragment>
          {isDetailed && !stripeIsLoading && (
            <CustomBillingDetailsFormField
              inputName="billingEmail"
              label={t('Billing email')}
              help={t(
                'If provided, all billing-related notifications will be sent to this address'
              )}
              placeholder={t('name@example.com (optional)')}
              value={form.getValue('billingEmail') ?? ''}
              fieldProps={fieldProps}
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
              ).map(([code]) => code as string),
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
              value={form.getValue('taxNumber') ?? ''}
              placeholder={taxFieldInfo.placeholder}
              fieldProps={fieldProps}
            />
          )}
        </Fragment>
      )}
    </Flex>
  );
}

function CustomBillingDetailsFormField({
  inputName,
  label,
  help,
  placeholder,
  value,
  fieldProps,
}: {
  inputName: string;
  label: string;
  value: string;
  fieldProps?: FieldGroupProps;
  help?: React.ReactNode;
  placeholder?: string;
}) {
  return (
    <Flex direction="column" gap="xs">
      <Flex align="center" gap="xs">
        <Text size="sm" variant="muted">
          {label}
        </Text>
        <QuestionTooltip title={help} size="sm" />
      </Flex>
      <StyledTextField
        {...fieldProps}
        name={inputName}
        placeholder={placeholder}
        value={value}
        aria-label={label}
      />
    </Flex>
  );
}

/**
 * Billing details form to be rendered inside a panel. This is
 * used in checkout, legal & compliance, and subscription settings.
 */
function BillingDetailsForm({
  initialData,
  onPreSubmit,
  onSubmitError,
  onSubmitSuccess,
  organization,
  submitLabel,
  footerStyle,
  requireChanges,
  isDetailed = true,
  fieldProps,
  extraButton,
  analyticsEvent,
}: Props) {
  const [submitDisabled, setSubmitDisabled] = useState(true);
  const transformData = (data: Record<string, any>) => {
    // Clear tax number if not applicable to country code.
    // This is done on save instead of on change to retain the field value
    // if the user makes a mistake.
    if (!countryHasSalesTax(data.countryCode)) {
      data.taxNumber = null;
    }

    // Clear the region if not applicable to country code.
    if (
      countryHasRegionChoices(data.countryCode) &&
      !getRegionChoiceCode(data.countryCode, data.region)
    ) {
      data.region = undefined;
    }

    return data;
  };

  const [form] = useState(() => new FormModel({transformData}));
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

  const updateCountryCodeState = (countryCode: string) =>
    setState({
      ...state,
      countryCode,
      showTaxNumber: countryHasSalesTax(countryCode),
    });

  const handleStripeFormChange = (data: any) => {
    form.setValue('companyName', data.value.name);
    form.setValue('addressLine1', data.value.address.line1);
    form.setValue('addressLine2', data.value.address.line2);
    form.setValue('city', data.value.address.city);
    form.setValue('region', data.value.address.state);
    form.setValue('countryCode', data.value.address.country);
    form.setValue('postalCode', data.value.address.postal_code);
    updateCountryCodeState(data.value.address.country ?? '');
  };

  useEffect(() => {
    const requiredFields = ['addressLine1', 'countryCode'];
    requiredFields.forEach(field => {
      form.setFieldDescriptor(field, {
        required: true,
      });
    });

    return () => {
      requiredFields.forEach(field => {
        form.removeField(field);
      });
    };
  }, [form]);

  if (!organization.access.includes('org:billing')) {
    return null;
  }

  const handleSubmit = (data: Record<PropertyKey, unknown>) => {
    if (analyticsEvent) {
      trackGetsentryAnalytics(analyticsEvent, {
        organization,
        isStripeComponent: true,
        referrer: decodeScalar(location.query?.referrer),
      });
    }
    onSubmitSuccess(data);
  };

  const transformedInitialData = {
    ...initialData,
    region: countryHasRegionChoices(initialData?.countryCode)
      ? getRegionChoiceCode(initialData?.countryCode, initialData?.region)
      : initialData?.region,
  };

  return (
    <StripeWrapper>
      <Form
        apiMethod="PUT"
        model={form}
        requireChanges={requireChanges}
        submitDisabled={submitDisabled}
        apiEndpoint={`/customers/${organization.slug}/billing-details/`}
        submitLabel={submitLabel}
        onPreSubmit={onPreSubmit}
        onSubmitSuccess={handleSubmit}
        onSubmitError={err => onSubmitError?.(err)}
        initialData={transformedInitialData}
        footerStyle={footerStyle}
        extraButton={extraButton}
      >
        <BillingDetailsFormFields
          form={form}
          isDetailed={isDetailed}
          fieldProps={fieldProps}
          initialData={initialData}
          handleStripeFormChange={handleStripeFormChange}
          state={state}
          taxFieldInfo={taxFieldInfo}
          onSubmitDisabled={setSubmitDisabled}
        />
      </Form>
    </StripeWrapper>
  );
}

export default BillingDetailsForm;

const StyledTextField = styled(TextField)`
  padding: 0;
  & > div {
    padding: 0;
  }
`;
