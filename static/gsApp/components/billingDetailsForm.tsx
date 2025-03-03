import {Fragment, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import type {LoadScriptNextProps} from '@react-google-maps/api';
import {useLoadScript} from '@react-google-maps/api';
import * as Sentry from '@sentry/react';

import AutoComplete from 'sentry/components/autoComplete';
import {Input} from 'sentry/components/core/input';
import DropdownBubble from 'sentry/components/dropdownBubble';
import type {FieldGroupProps} from 'sentry/components/forms/fieldGroup/types';
import SelectField from 'sentry/components/forms/fields/selectField';
import TextField from 'sentry/components/forms/fields/textField';
import Form from 'sentry/components/forms/form';
import FormField from 'sentry/components/forms/formField';
import FormModel from 'sentry/components/forms/model';
import MenuListItem from 'sentry/components/menuListItem';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';

import type {BillingDetails} from 'getsentry/types';
import {countryCodes} from 'getsentry/utils/ISO3166codes';
import type {TaxFieldInfo} from 'getsentry/utils/salesTax';
import {
  countryHasRegionChoices,
  countryHasSalesTax,
  getRegionChoiceCode,
  getRegionChoices,
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
   * Defaults to `DefaultWrapper`.
   */
  wrapper?: (children: any) => React.ReactElement;
};

function DefaultWrapper({children}: any) {
  return <div>{children}</div>;
}

type State = {
  showTaxNumber: boolean;
  countryCode?: string | null;
  taxFieldInfo?: TaxFieldInfo;
};

const GOOGLE_MAPS_LOAD_OPTIONS: LoadScriptNextProps = {
  googleMapsApiKey: ConfigStore.get('getsentry.googleMapsApiKey'),
  libraries: ['places'],
} as LoadScriptNextProps;

// must be of type autoComplete.Item
type PredictionItem = google.maps.places.AutocompletePrediction & {
  'data-test-id'?: string;
  disabled?: boolean;
};

function transformData(data: Record<string, any>) {
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
  const {isLoaded} = useLoadScript(GOOGLE_MAPS_LOAD_OPTIONS);

  const [form] = useState(() => new FormModel({transformData}));

  const autoCompleteService = useMemo(
    () => (isLoaded ? new google.maps.places.AutocompleteService() : null),
    [isLoaded]
  );

  const [state, setState] = useState<State>({
    countryCode: initialData?.countryCode,
    showTaxNumber:
      !!initialData?.taxNumber || countryHasSalesTax(initialData?.countryCode),
  });

  const [predictionData, setPredictionData] = useState<
    google.maps.places.AutocompletePrediction[]
  >([]);
  const [placeService, setPlaceService] = useState<google.maps.places.PlacesService>();

  const FieldWrapper = wrapper;

  const transformedInitialData = {
    ...initialData,
    region: countryHasRegionChoices(initialData?.countryCode)
      ? getRegionChoiceCode(initialData?.countryCode, initialData?.region)
      : initialData?.region,
  };

  const taxFieldInfo = getTaxFieldInfo(state.countryCode);
  const regionChoices = getRegionChoices(state.countryCode);

  function updateCountryCodeState(countryCode: string) {
    setState({
      ...state,
      countryCode,
      showTaxNumber: countryHasSalesTax(countryCode),
    });
  }

  async function handleAddressChange(e: React.ChangeEvent<HTMLInputElement>) {
    // AutoCompleteService library must be loaded to proceed with prediction
    if (!autoCompleteService) {
      return;
    }

    // length of input address string should be at least 5 to proceed with prediction
    if (!e.target.value || e.target.value.length < 5) {
      return;
    }

    try {
      const autocompleteResponse: google.maps.places.AutocompleteResponse =
        await autoCompleteService.getPlacePredictions({
          input: e.target.value,
          // See https://developers.google.com/maps/documentation/javascript/supported_types
          types: ['address'],
        });

      if (autocompleteResponse?.predictions) {
        setPredictionData(autocompleteResponse.predictions);
      }
      if (!placeService) {
        setPlaceService(new google.maps.places.PlacesService(e.target));
      }
    } catch (exception) {
      Sentry.captureException(exception);
    }
  }

  // On selection, need to use PlaceService to fetch more data about the address (e.g. postal code)
  // that is not available in the prediction.
  function handleSelectEvent(item: PredictionItem, e: any) {
    if (e.key === 'Enter') {
      e.preventDefault();
    }
    if (!placeService) {
      return;
    }
    try {
      placeService.getDetails(
        {
          placeId: item.place_id ?? '',
          // See https://developers.google.com/maps/documentation/javascript/geocoding#GeocodingAddressTypes
          fields: ['address_components'],
        },
        (
          placeResult: google.maps.places.PlaceResult | null,
          placeServiceStatus: google.maps.places.PlacesServiceStatus
        ) => {
          if (
            placeServiceStatus === google.maps.places.PlacesServiceStatus.OK &&
            placeResult
          ) {
            const placeDetails = getPlaceDetailsItems(placeResult);
            form.setValue('addressLine1', placeDetails.addressLine1);
            form.setValue('city', placeDetails.city);
            form.setValue('region', placeDetails.regionCode);
            form.setValue('countryCode', placeDetails.countryCode);
            form.setValue('postalCode', placeDetails.postalCode);
            updateCountryCodeState(placeDetails.countryCode);
          }
        }
      );
    } catch (exception) {
      Sentry.captureException(exception);
    }
  }

  // See https://developers.google.com/maps/documentation/javascript/geocoding#GeocodingAddressTypes
  // for structure of PlaceResult and PlaceResult.address_components
  function getPlaceDetailsItems(placeResult: google.maps.places.PlaceResult) {
    const placeDetails = {
      addressLine1: '',
      city: '',
      country: '',
      countryCode: '',
      postalCode: '',
      region: '',
      regionCode: '',
      streetName: '',
      streetNumber: '',
      formattedAddress: '',
    };
    for (const addressComponent of placeResult.address_components ?? []) {
      const componentTypes = addressComponent.types;
      if (componentTypes.includes('street_number')) {
        placeDetails.streetNumber = addressComponent.long_name;
      } else if (componentTypes.includes('route')) {
        placeDetails.streetName = addressComponent.long_name;
      } else if (
        componentTypes.includes('postal_town') ||
        componentTypes.includes('locality')
      ) {
        placeDetails.city = addressComponent.long_name;
      } else if (componentTypes.includes('country')) {
        placeDetails.country = addressComponent.long_name;
        placeDetails.countryCode = addressComponent.short_name;
      } else if (componentTypes.includes('administrative_area_level_1')) {
        placeDetails.region = addressComponent.long_name;
        placeDetails.regionCode = addressComponent.short_name;
      } else if (componentTypes.includes('postal_code')) {
        placeDetails.postalCode = addressComponent.long_name;
      }
    }

    placeDetails.addressLine1 = [placeDetails.streetNumber, placeDetails.streetName]
      .filter(i => !!i)
      .join(' ');
    return placeDetails;
  }

  return (
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
        {isDetailed && (
          <TextField
            name="billingEmail"
            label={t('Billing Email')}
            placeholder="billing@example.com"
            help={t(
              'If provided, all receipts and billing-related notifications will be sent to this address.'
            )}
            {...fieldProps}
          />
        )}

        <TextField
          name="companyName"
          label={t('Company Name')}
          placeholder={t('Company name')}
          maxLength={100}
          {...fieldProps}
        />

        <AutoComplete
          onSelect={handleSelectEvent}
          itemToString={(selectItem?: PredictionItem) =>
            selectItem?.structured_formatting.main_text ?? ''
          }
          defaultInputValue={transformedInitialData.addressLine1 ?? ''}
          shouldSelectWithEnter
        >
          {({
            getInputProps,
            getItemProps,
            getMenuProps,
            isOpen,
            highlightedIndex,
            registerItemCount,
            registerVisibleItem,
          }) => (
            <FormField
              {...fieldProps}
              required
              name="addressLine1"
              label={t('Street Address 1')}
              help={
                isDetailed
                  ? t("Your company's address of record will appear on all receipts.")
                  : undefined
              }
            >
              {({onChange}: any) => {
                registerItemCount(predictionData.length);

                return (
                  <Fragment>
                    <Input
                      id="addressLine1"
                      required
                      name="addressLine1"
                      placeholder={t('Street address')}
                      maxLength={100}
                      {...getInputProps({
                        onChange: e => {
                          onChange(e); // call the default onChange to set the FormModel with the value of addressLine1
                          handleAddressChange(e);
                        },
                      })}
                      disabled={!organization.access.includes('org:billing')}
                    />

                    {predictionData.length > 0 && isOpen && (
                      <StyledDropdownBubble
                        alignMenu="left"
                        blendCorner={false}
                        {...getMenuProps()}
                      >
                        {predictionData.map((item, index) => (
                          <AddressItem
                            item={item}
                            index={index}
                            key={index}
                            priority={index === highlightedIndex ? 'primary' : 'default'}
                            registerVisibleItem={registerVisibleItem}
                            {...getItemProps({index, item})}
                          />
                        ))}
                      </StyledDropdownBubble>
                    )}
                  </Fragment>
                );
              }}
            </FormField>
          )}
        </AutoComplete>

        <TextField
          name="addressLine2"
          label={t('Street Address 2')}
          placeholder={t('Unit, building, floor, etc.')}
          maxLength={100}
          {...fieldProps}
        />

        <SelectField
          required
          allowClear
          name="countryCode"
          label={t('Country')}
          placeholder={t('Country')}
          choices={COUNTRY_CODE_CHOICES}
          onChange={updateCountryCodeState}
          {...fieldProps}
        />

        <TextField
          required
          name="city"
          label={t('City')}
          placeholder={t('City')}
          maxLength={100}
          {...fieldProps}
        />
        {regionChoices.length ? (
          <SelectField
            required
            allowClear
            name="region"
            label={t('State / Region')}
            placeholder={t('State or region')}
            choices={regionChoices}
            {...fieldProps}
          />
        ) : (
          <TextField
            required
            name="region"
            label={t('State / Region')}
            placeholder={t('State or region')}
            maxLength={100}
            {...fieldProps}
          />
        )}
        <TextField
          required
          name="postalCode"
          label={t('Postal Code')}
          placeholder={t('Postal code')}
          maxLength={12}
          {...fieldProps}
        />
        {!!(state.showTaxNumber && taxFieldInfo) && (
          <TextField
            name="taxNumber"
            label={taxFieldInfo.label}
            placeholder={taxFieldInfo.placeholder}
            help={tct(
              "Your company's [taxNumberName] will appear on all receipts. You may be subject to taxes depending on country specific tax policies.",
              {taxNumberName: <strong>{taxFieldInfo.taxNumberName}</strong>}
            )}
            maxLength={25}
            {...fieldProps}
          />
        )}
      </FieldWrapper>
    </Form>
  );
}

type AddressItemProps = React.ComponentProps<typeof MenuListItem> & {
  index: number;
  item: PredictionItem;
  registerVisibleItem: (index: number, item: PredictionItem) => void;
};

function AddressItem({registerVisibleItem, index, item, ...props}: AddressItemProps) {
  useEffect(() => {
    registerVisibleItem(index, item);
  }, [item, index, registerVisibleItem]);

  return <MenuListItem label={item.description} {...props} />;
}

const StyledDropdownBubble = styled(DropdownBubble)`
  margin-top: ${space(1)};
`;

export default BillingDetailsForm;
