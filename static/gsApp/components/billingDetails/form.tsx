import {useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {AddressElement} from '@stripe/react-stripe-js';

import {Flex} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import type {FieldGroupProps} from 'sentry/components/forms/fieldGroup/types';
import TextField from 'sentry/components/forms/fields/textField';
import Form from 'sentry/components/forms/form';
import FormModel from 'sentry/components/forms/model';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';

import LegacyBillingDetailsForm from 'getsentry/components/billingDetails/legacyForm';
import StripeWrapper from 'getsentry/components/stripeWrapper';
import type {BillingDetails} from 'getsentry/types';
import {hasStripeComponentsFeature} from 'getsentry/utils/billing';
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
  /**
   * Custom wrapper for the form fields.
   */
  wrapper?: (children: any) => React.ReactElement;
};

type State = {
  showTaxNumber: boolean;
  countryCode?: string | null;
  taxFieldInfo?: TaxFieldInfo;
};

const GOOGLE_MAPS_API_KEY = ConfigStore.get('getsentry.googleMapsApiKey');

function DefaultWrapper({children}: any) {
  return <div>{children}</div>;
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
  wrapper = DefaultWrapper,
  fieldProps,
  extraButton,
  analyticsEvent,
}: Props) {
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
  const hasStripeComponents = hasStripeComponentsFeature(organization);
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
    const requiredFields = ['addressLine1', 'city', 'countryCode'];
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

  useEffect(() => {
    if (countryHasRegionChoices(state.countryCode)) {
      form.setFieldDescriptor('region', {required: true});
    } else {
      form.setFieldDescriptor('region', {required: false});
    }

    return () => {
      form.removeField('region');
    };
  }, [state.countryCode, form]);

  if (!organization.access.includes('org:billing')) {
    return null;
  }

  const handleSubmit = (data: Record<PropertyKey, unknown>) => {
    if (analyticsEvent) {
      trackGetsentryAnalytics(analyticsEvent, {
        organization,
        isStripeComponent: hasStripeComponents,
        referrer: decodeScalar(location.query?.referrer),
      });
    }
    onSubmitSuccess(data);
  };

  if (!hasStripeComponents) {
    return (
      <LegacyBillingDetailsForm
        initialData={initialData}
        onSubmitSuccess={handleSubmit}
        organization={organization}
        onSubmitError={onSubmitError}
        onPreSubmit={onPreSubmit}
        footerStyle={footerStyle}
        requireChanges={requireChanges}
        isDetailed={isDetailed}
        wrapper={wrapper}
        submitLabel={submitLabel}
        fieldProps={fieldProps}
      />
    );
  }

  const FieldWrapper = wrapper;

  const transformedInitialData = {
    ...initialData,
    region: countryHasRegionChoices(initialData?.countryCode)
      ? getRegionChoiceCode(initialData?.countryCode, initialData?.region)
      : initialData?.region,
  };

  return (
    <Form
      apiMethod="PUT"
      model={form}
      requireChanges={requireChanges}
      apiEndpoint={`/customers/${organization.slug}/billing-details/`}
      submitLabel={submitLabel}
      onPreSubmit={onPreSubmit}
      onSubmitSuccess={handleSubmit}
      onSubmitError={onSubmitError}
      initialData={transformedInitialData}
      footerStyle={footerStyle}
      extraButton={extraButton}
    >
      <FieldWrapper>
        <Flex direction="column" gap="xl">
          {isDetailed && (
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
          <StripeWrapper>
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
            />
          </StripeWrapper>
          {!!(state.showTaxNumber && taxFieldInfo) && (
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
        </Flex>
      </FieldWrapper>
    </Form>
  );
}

export default BillingDetailsForm;

const StyledTextField = styled(TextField)`
  padding: 0;
  & > div {
    padding: 0;
  }
`;
