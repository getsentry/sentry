import {Fragment, useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {Alert} from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelFooter from 'sentry/components/panels/panelFooter';
import PanelItem from 'sentry/components/panels/panelItem';
import {IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useApi from 'sentry/utils/useApi';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

import BillingDetailsForm from 'getsentry/components/billingDetailsForm';
import type {BillingDetails} from 'getsentry/types';
import {AddressType} from 'getsentry/types';
import {getCountryByCode} from 'getsentry/utils/ISO3166codes';
import {getRegionChoiceName, getTaxFieldInfo} from 'getsentry/utils/salesTax';
import StepHeader from 'getsentry/views/amCheckout/steps/stepHeader';
import type {StepProps} from 'getsentry/views/amCheckout/types';

type State = {
  isLoading: boolean;
  loadError: Error | null;
  submitError: any;
  useExisting: boolean;
  billingDetails?: BillingDetails;
};

function FormFieldWrapper({children}: {children: React.ReactNode}) {
  return <FormFieldBody>{children}</FormFieldBody>;
}

function AddBillingDetails({
  isActive,
  isCompleted,
  onEdit,
  organization,
  prevStepCompleted,
  stepNumber,
  onCompleteStep,
}: StepProps) {
  const title = t('Billing Details');

  const [state, setState] = useState<State>({
    submitError: null,
    isLoading: false,
    loadError: null,
    useExisting: false,
  });

  const api = useApi();

  const fetchBillingDetails = useCallback(async () => {
    if (isActive) {
      setState(prevState => ({...prevState, isLoading: true, loadError: null}));

      try {
        const response: BillingDetails = await api.requestPromise(
          `/customers/${organization.slug}/billing-details/`
        );

        setState(prevState => ({
          ...prevState,
          isLoading: false,
          billingDetails: response,
          useExisting: response.addressType === AddressType.STRUCTURED,
        }));
      } catch (error) {
        setState(prevState => ({...prevState, loadError: error, isLoading: false}));
        if (error.status !== 401 && error.status !== 403) {
          Sentry.captureException(error);
        }
      }
    }
  }, [isActive, api, organization.slug]);

  useEffect(() => {
    fetchBillingDetails();
  }, [fetchBillingDetails]);

  function renderDetailsForm() {
    if (state.isLoading || state.loadError || !state.billingDetails) {
      return (
        <Fragment>
          {state.loadError ? (
            <LoadingError onRetry={fetchBillingDetails} />
          ) : (
            <LoadingIndicator />
          )}
          <StepFooter>
            <Button disabled priority="primary">
              {t('Continue')}
            </Button>
          </StepFooter>
        </Fragment>
      );
    }

    const hasBillingAddress = state.billingDetails.addressType === AddressType.STRUCTURED;
    const footerStyle = {paddingRight: `${space(2)}`};
    const fieldProps = {
      stacked: true,
      inline: false,
      flexibleControlStateSize: true,
      showHelpInTooltip: true,
    };

    if (state.useExisting) {
      return (
        <FormWrapper
          icon={<IconEdit size="xs" />}
          hasBillingAddress={hasBillingAddress}
          onClick={() => setState({...state, useExisting: false})}
          editButtonLabel={t('Edit Details')}
        >
          <AddressItems billingDetails={state.billingDetails} />
          <StepFooter>
            <Button priority="primary" onClick={() => onCompleteStep(stepNumber)}>
              {t('Continue')}
            </Button>
          </StepFooter>
        </FormWrapper>
      );
    }

    return (
      <FormWrapper
        hasBillingAddress={hasBillingAddress}
        onClick={() => setState({...state, useExisting: true})}
        editButtonLabel={t('Cancel')}
      >
        {state.submitError && (
          <ErrorAlert type="error">
            {t('There was an error submitting billing details. Please try again.')}
          </ErrorAlert>
        )}
        <BillingDetailsForm
          isDetailed={false}
          initialData={state.billingDetails}
          requireChanges={false}
          wrapper={FormFieldWrapper}
          organization={organization}
          onPreSubmit={() => setState({...state, submitError: null})}
          onSubmitSuccess={() => onCompleteStep(stepNumber)}
          onSubmitError={err => setState({...state, submitError: err})}
          submitLabel={t('Continue')}
          fieldProps={fieldProps}
          footerStyle={footerStyle}
        />
      </FormWrapper>
    );
  }

  return (
    <Panel>
      <StepHeader
        canSkip={prevStepCompleted}
        title={title}
        isActive={isActive}
        stepNumber={stepNumber}
        isCompleted={isCompleted}
        onEdit={onEdit}
      />
      {isActive && <PanelBody data-test-id={title}>{renderDetailsForm()}</PanelBody>}
    </Panel>
  );
}

type FormWrapperProps = {
  children: React.ReactNode;
  editButtonLabel: React.ReactNode;
  hasBillingAddress?: boolean;
  icon?: React.ReactNode;
  onClick?: () => void;
};

function FormWrapper({
  children,
  editButtonLabel,
  hasBillingAddress,
  icon,
  onClick,
}: FormWrapperProps) {
  return (
    <Fragment>
      <Heading>
        <DetailsText>
          {t('Current billing details on file')}
          <SubText>
            {t("Your company's address of record will appear on all receipts.")}
          </SubText>
        </DetailsText>
        {hasBillingAddress && (
          <Button size="xs" icon={icon} onClick={onClick}>
            {editButtonLabel}
          </Button>
        )}
      </Heading>
      {children}
    </Fragment>
  );
}

type AddressItemProps = {title: React.ReactNode; value: string | null};

function AddressItem({title, value}: AddressItemProps) {
  if (!value) {
    return null;
  }
  return (
    <StyledPanelItem>
      <SubText>{title}</SubText>
      <div>{value}</div>
    </StyledPanelItem>
  );
}

function AddressItems({billingDetails}: {billingDetails: BillingDetails}) {
  const taxFieldInfo = getTaxFieldInfo(billingDetails.countryCode);
  const countryName =
    getCountryByCode(billingDetails.countryCode)?.name || billingDetails.countryCode;
  const regionName = getRegionChoiceName(
    billingDetails.countryCode,
    billingDetails.region
  );

  return (
    <StyledAddressItems>
      <AddressItem title={t('Company Name')} value={billingDetails.companyName} />
      <AddressItem title={t('Country')} value={countryName} />
      <AddressItem title={t('Street Address 1')} value={billingDetails.addressLine1} />
      <AddressItem title={t('Street Address 2')} value={billingDetails.addressLine2} />
      <AddressItem title={t('City')} value={billingDetails.city} />
      <AddressItem title={t('State / Region')} value={regionName} />
      <AddressItem title={t('Postal Code')} value={billingDetails.postalCode} />
      <AddressItem title={taxFieldInfo.label} value={billingDetails.taxNumber} />
    </StyledAddressItems>
  );
}

export default AddBillingDetails;

const FormFieldBody = styled('div')`
  padding: ${space(2)} 0 ${space(2)} ${space(2)};
`;

const ErrorAlert = styled(Alert)`
  margin: ${space(2)} ${space(2)} 0px ${space(2)};
`;

const StepFooter = styled(PanelFooter)`
  padding: ${space(2)};
  display: grid;
  align-items: center;
  justify-content: end;
`;

const Heading = styled('div')`
  display: grid;
  grid-auto-flow: column;
  justify-content: space-between;
  align-items: center;
  padding: ${space(2)} ${space(2)} ${space(1)} ${space(2)};
  gap: ${space(4)};
`;

const DetailsText = styled(TextBlock)`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  margin-bottom: 0px;
  font-weight: 600;
`;

const SubText = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.subText};
  line-height: 1.2;
  font-weight: normal;
`;

const StyledPanelItem = styled(PanelItem)`
  display: grid;
  grid-auto-flow: row;
  padding: ${space(1.5)} 0;
  gap: ${space(1)};

  &:first-child {
    padding-top: 0px;
  }

  &:last-child {
    padding-bottom: 0px;
  }
`;

const StyledAddressItems = styled('div')`
  padding: ${space(2)};
`;
