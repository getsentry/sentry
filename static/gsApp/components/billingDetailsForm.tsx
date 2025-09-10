import {useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {LoadScriptNextProps} from '@react-google-maps/api';
import {useLoadScript} from '@react-google-maps/api';
import {AddressElement, Elements} from '@stripe/react-stripe-js';
import type {StripeAddressElementChangeEvent} from '@stripe/stripe-js';

import {debossedBackground} from 'sentry/components/core/chonk';
import {type InputProps} from 'sentry/components/core/input';
import {Flex} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';
import type {FieldGroupProps} from 'sentry/components/forms/fieldGroup/types';
import TextField from 'sentry/components/forms/fields/textField';
import Form from 'sentry/components/forms/form';
import FormModel from 'sentry/components/forms/model';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';

import LegacyBillingDetailsForm from 'getsentry/components/legacyBillingDetailsForm';
import {useStripeInstance} from 'getsentry/hooks/useStripeInstance';
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

const COUNTRY_CODE_CHOICES = countryCodes.map(({name, code}) => [code, name]);

type Props = {
  onSubmitSuccess: (data: Record<PropertyKey, unknown>) => void;
  organization: Organization;
  /**
   * Additional form field props.
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

const GOOGLE_MAPS_LOAD_OPTIONS: LoadScriptNextProps = {
  googleMapsApiKey: ConfigStore.get('getsentry.googleMapsApiKey'),
  libraries: ['places'],
} as LoadScriptNextProps;

function DefaultWrapper({children}: any) {
  return <div>{children}</div>;
}

function CustomBillingDetailsFormField({
  inputName,
  label,
  help,
  placeholder,
  value,
  inputProps,
}: {
  inputName: string;
  label: string;
  value: string;
  help?: React.ReactNode;
  inputProps?: InputProps;
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
        name={inputName}
        placeholder={placeholder}
        {...inputProps}
        value={value}
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
  fieldProps,
  requireChanges,
  isDetailed = true,
  wrapper = DefaultWrapper,
}: Props) {
  const theme = useTheme();
  const prefersDarkMode = useLegacyStore(ConfigStore).theme === 'dark';
  const {isLoaded} = useLoadScript(GOOGLE_MAPS_LOAD_OPTIONS);
  const stripe = useStripeInstance();

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

  const handleStripeFormChange = (data: StripeAddressElementChangeEvent) => {
    if (data.complete) {
      form.setValue('companyName', data.value.name);
      form.setValue('addressLine1', data.value.address.line1);
      form.setValue('addressLine2', data.value.address.line2);
      form.setValue('city', data.value.address.city);
      form.setValue('region', data.value.address.state);
      form.setValue('countryCode', data.value.address.country);
      form.setValue('postalCode', data.value.address.postal_code);
      updateCountryCodeState(data.value.address.country ?? '');
    } else {
      if (form.getValue('countryCode') !== data.value.address.country) {
        form.setValue('countryCode', data.value.address.country);
        updateCountryCodeState(data.value.address.country ?? '');
      }
    }
  };

  if (!hasStripeComponentsFeature(organization)) {
    return (
      <LegacyBillingDetailsForm
        initialData={initialData}
        onSubmitSuccess={onSubmitSuccess}
        organization={organization}
        onSubmitError={onSubmitError}
        onPreSubmit={onPreSubmit}
        footerStyle={footerStyle}
        fieldProps={fieldProps}
        requireChanges={requireChanges}
        isDetailed={isDetailed}
        wrapper={wrapper}
        submitLabel={submitLabel}
      />
    );
  }

  if (!isLoaded) {
    return <LoadingIndicator />;
  }

  const FieldWrapper = wrapper;

  const transformedInitialData = {
    ...initialData,
    region: countryHasRegionChoices(initialData?.countryCode)
      ? getRegionChoiceCode(initialData?.countryCode, initialData?.region)
      : initialData?.region,
  };

  return (
    <Flex direction="column" gap="lg">
      <Heading as="h2" size="md">
        {t('Invoice Details')}
      </Heading>
      <Form
        apiMethod="PUT"
        model={form}
        requireChanges={requireChanges}
        apiEndpoint={`/customers/${organization.slug}/billing-details/`}
        submitLabel={submitLabel}
        onPreSubmit={onPreSubmit}
        onSubmitSuccess={onSubmitSuccess}
        onSubmitError={onSubmitError}
        initialData={transformedInitialData}
        footerStyle={footerStyle}
      >
        <FieldWrapper>
          <Flex direction="column" gap="xl">
            <CustomBillingDetailsFormField
              inputName="billingEmail"
              label={t('Billing email')}
              help={t(
                'If provided, all billing-related notifications will be sent to this address'
              )}
              placeholder={t('name@example.com (optional)')}
              value={form.getValue('billingEmail') ?? ''}
            />
            <Elements
              stripe={stripe}
              options={{
                appearance: {
                  theme: prefersDarkMode ? 'night' : 'stripe',
                  variables: {
                    borderRadius: theme.borderRadius,
                    colorBackground: theme.background,
                    colorText: theme.textColor,
                    colorDanger: theme.danger,
                    colorSuccess: theme.success,
                    colorWarning: theme.warning,
                    iconColor: theme.textColor,
                  },
                  rules: {
                    '.Input': {
                      fontSize: theme.fontSize.md,
                      boxShadow: '0px 2px 0px 0px #DFDBEF inset',
                      backgroundColor: debossedBackground(theme as any).backgroundColor,
                    },
                    '.Label': {
                      fontSize: theme.fontSize.sm,
                      color: theme.subText,
                    },
                  },
                },
              }}
            >
              <AddressElement
                options={{
                  mode: 'billing',
                  autocomplete: {
                    mode: 'google_maps_api',
                    apiKey: GOOGLE_MAPS_LOAD_OPTIONS.googleMapsApiKey,
                  },
                  allowedCountries: COUNTRY_CODE_CHOICES.filter(([code]) =>
                    defined(code)
                  ).map(([code]) => code as string),
                  fields: {phone: 'never'},
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
            </Elements>
            {!!(state.showTaxNumber && taxFieldInfo) && (
              <CustomBillingDetailsFormField
                inputName="taxNumber"
                label={taxFieldInfo.label}
                help={tct(
                  "Your company's [taxNumberName] will appear on all receipts. You may be subject to taxes depending on country specific tax policies.",
                  {taxNumberName: <strong>{taxFieldInfo.taxNumberName}</strong>}
                )}
                placeholder={taxFieldInfo.placeholder}
                value={initialData?.taxNumber ?? ''}
              />
            )}
          </Flex>
        </FieldWrapper>
      </Form>
    </Flex>
  );
}

export default BillingDetailsForm;

const StyledTextField = styled(TextField)`
  padding: 0;
  & > div {
    padding: 0;
  }
`;
