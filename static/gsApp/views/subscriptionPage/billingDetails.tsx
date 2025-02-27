import {Component, Fragment, useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import type {Location} from 'history';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/button';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {decodeScalar} from 'sentry/utils/queryString';
import useApi from 'sentry/utils/useApi';
import withOrganization from 'sentry/utils/withOrganization';

import {openEditCreditCard} from 'getsentry/actionCreators/modal';
import BillingDetailsForm from 'getsentry/components/billingDetailsForm';
import withSubscription from 'getsentry/components/withSubscription';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import type {BillingDetails as BillingDetailsType, Subscription} from 'getsentry/types';
import {AddressType} from 'getsentry/types';
import formatCurrency from 'getsentry/utils/formatCurrency';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';
import ContactBillingMembers from 'getsentry/views/contactBillingMembers';
import RecurringCredits from 'getsentry/views/subscriptionPage/recurringCredits';

import SubscriptionHeader from './subscriptionHeader';
import {trackSubscriptionView} from './utils';

type Props = {
  location: Location;
  organization: Organization;
  subscription: Subscription;
};

type State = {
  cardLastFourDigits: string | null;
  cardZipCode: string | null;
  countryCode?: Subscription['countryCode'];
};

/**
 * Update billing details view.
 */
class BillingDetails extends Component<Props, State> {
  state: State = {
    cardLastFourDigits: null,
    cardZipCode: null,
  };

  static getDerivedStateFromProps(props: Readonly<Props>, state: State) {
    const {subscription} = props;
    const {cardLastFourDigits, cardZipCode} = state;

    if (!subscription) {
      return {};
    }

    return {
      cardLastFourDigits:
        cardLastFourDigits ?? (subscription.paymentSource?.last4 || null),
      cardZipCode: cardZipCode ?? (subscription.paymentSource?.zipCode || null),
    };
  }

  componentDidMount() {
    const {organization, subscription, location} = this.props;
    trackSubscriptionView(organization, subscription, 'details');

    // Open update credit card modal and track clicks from payment failure emails and GS Banner
    const queryReferrer = decodeScalar(location?.query?.referrer);
    // There are multiple billing failure referrals and each should have analytics tracking
    if (queryReferrer?.includes('billing-failure')) {
      openEditCreditCard({
        organization,
        onSuccess: this.handleCardUpdated,
        location,
      });
      trackGetsentryAnalytics('billing_failure.button_clicked', {
        organization,
        referrer: queryReferrer,
      });
    }
  }

  handleCardUpdated = (data: Subscription) => {
    this.setState({
      countryCode: data.countryCode,
      cardLastFourDigits: data.paymentSource?.last4 || null,
      cardZipCode: data.paymentSource?.zipCode || null,
    });
    SubscriptionStore.set(data.slug, data);
  };

  handleSubmitSuccess = (data: Subscription) => {
    addSuccessMessage(t('Successfully updated billing details.'));
    SubscriptionStore.set(data.slug, data);
  };

  render() {
    const {organization, subscription} = this.props;
    const hasBillingPerms = organization.access?.includes('org:billing');
    if (!hasBillingPerms) {
      return <ContactBillingMembers />;
    }

    if (!subscription) {
      return <LoadingIndicator />;
    }

    const {cardLastFourDigits, cardZipCode} = this.state;

    const balance =
      subscription.accountBalance < 0
        ? tct('[credits] credit', {
            credits: formatCurrency(0 - subscription.accountBalance),
          })
        : `${formatCurrency(subscription.accountBalance)}`;

    return (
      <Fragment>
        <SubscriptionHeader organization={organization} subscription={subscription} />
        <RecurringCredits displayType="discount" planDetails={subscription.planDetails} />
        <Panel className="ref-credit-card-details">
          <PanelHeader hasButtons>
            {t('Credit Card On File')}
            <Button
              data-test-id="update-card"
              priority="primary"
              size="sm"
              onClick={() =>
                openEditCreditCard({
                  organization,
                  onSuccess: this.handleCardUpdated,
                })
              }
            >
              {t('Update card')}
            </Button>
          </PanelHeader>
          <PanelBody>
            <FieldGroup label={t('Credit Card Number')}>
              <TextForField>
                {cardLastFourDigits ? (
                  `xxxx xxxx xxxx ${cardLastFourDigits}`
                ) : (
                  <em>{t('No card on file')}</em>
                )}
              </TextForField>
            </FieldGroup>

            <FieldGroup
              label={t('Postal Code')}
              help={t('Postal code associated with the card on file')}
            >
              <TextForField>{cardZipCode}</TextForField>
            </FieldGroup>
          </PanelBody>
        </Panel>

        <Panel className="ref-billing-details">
          <PanelHeader>{t('Billing Details')}</PanelHeader>
          <PanelBody data-test-id="account-balance">
            {subscription.accountBalance ? (
              <FieldGroup label="Account Balance">{balance}</FieldGroup>
            ) : null}
            <BillingDetailsFormContainer organization={organization} />
          </PanelBody>
        </Panel>
      </Fragment>
    );
  }
}

type FormState = {
  isLoading: boolean;
  loadError: Error | null;
  billingDetails?: BillingDetailsType;
};

function BillingDetailsFormContainer({organization}: {organization: Organization}) {
  const [state, setState] = useState<FormState>({
    isLoading: false,
    loadError: null,
  });

  const api = useApi();

  const fetchBillingDetails = useCallback(async () => {
    setState(prevState => ({...prevState, isLoading: true, loadError: null}));

    try {
      const response: BillingDetailsType = await api.requestPromise(
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
  }, [api, organization.slug]);

  useEffect(() => {
    fetchBillingDetails();
  }, [fetchBillingDetails]);

  if (state.isLoading) {
    return <LoadingIndicator />;
  }

  if (state.loadError) {
    return <LoadingError onRetry={fetchBillingDetails} />;
  }

  return (
    <BillingDetailsForm
      requireChanges
      initialData={state.billingDetails}
      organization={organization}
      onSubmitError={() => addErrorMessage(t('Unable to update billing details.'))}
      onSubmitSuccess={() =>
        addSuccessMessage(t('Successfully updated billing details.'))
      }
      fieldProps={{
        disabled: !organization.access.includes('org:billing'),
        disabledReason: t(
          "You don't have access to manage these billing and subscription details."
        ),
      }}
    />
  );
}

// Sets the min-height so a field displaying text will be the same height as a
// field that has an input
const TextForField = styled('span')`
  min-height: 37px;
  display: flex;
  align-items: center;
`;

export default withSubscription(withOrganization(BillingDetails));

/** @internal exported for tests only */
export {BillingDetails, BillingDetailsFormContainer};
