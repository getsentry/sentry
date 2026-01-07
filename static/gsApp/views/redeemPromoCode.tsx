import styled from '@emotion/styled';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {fetchOrganizationDetails} from 'sentry/actionCreators/organization';
import type {Client} from 'sentry/api';
import {Container} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import ApiForm from 'sentry/components/forms/apiForm';
import TextField from 'sentry/components/forms/fields/textField';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

import SubscriptionContext from 'getsentry/components/subscriptionContext';
import withSubscription from 'getsentry/components/withSubscription';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import type {Subscription} from 'getsentry/types';
import {isDisabledByPartner} from 'getsentry/utils/partnerships';
import SubscriptionPageContainer from 'getsentry/views/subscriptionPage/components/subscriptionPageContainer';
import PartnershipNote from 'getsentry/views/subscriptionPage/partnershipNote';

type Props = RouteComponentProps<unknown, unknown> & {
  api: Client;
  organization: Organization;
  subscription: Subscription;
};

function RedeemPromoCode({organization, api, subscription}: Props) {
  const {accountBalance} = subscription;
  const accountCredit =
    accountBalance < 0 ? Number((accountBalance / -100).toFixed(2)) : 0;
  useRouteAnalyticsParams({
    account_credit: accountCredit,
  });
  const AccountCredit =
    accountCredit > 0 ? (
      <AccountCreditWrapper id="account-balance">
        <ItemContainer>{t('Your account credit:')}</ItemContainer>
        <ItemContainer>{'$' + accountCredit.toString()}</ItemContainer>
      </AccountCreditWrapper>
    ) : null;

  if (isDisabledByPartner(subscription)) {
    return (
      <SubscriptionPageContainer background="secondary">
        <PartnershipNote subscription={subscription} />
      </SubscriptionPageContainer>
    );
  }
  return (
    <SubscriptionPageContainer background="secondary">
      <SubscriptionContext>
        <div className="ref-redeem-code">
          <SentryDocumentTitle
            title={t('Redeem Promo Code')}
            orgSlug={organization.slug}
          />
          <SettingsPageHeader title={t('Redeem Promotional Code')} />
          <Panel>
            <PanelHeader>{t('Redeem Promotional Code')}</PanelHeader>
            <PanelBody>
              <ApiForm
                extraButton={AccountCredit}
                apiMethod="PUT"
                apiEndpoint={`/customers/${organization.slug}/redeem-promo/`}
                submitLabel={t('Redeem')}
                resetOnError
                onSubmitSuccess={resp => {
                  const msg =
                    resp?.details ||
                    t('Successfully applied credit to your organization');

                  SubscriptionStore.loadData(organization.slug, null, {
                    markStartedTrial: true,
                  });
                  fetchOrganizationDetails(api, organization.slug);
                  addSuccessMessage(msg);
                }}
              >
                <Container padding="xl">
                  <Text>
                    <p>
                      {t(
                        'Received a promotional code? Enter it here to apply credit to your organization.'
                      )}
                    </p>
                  </Text>
                </Container>

                <TextField name="code" label={t('Promotional Code')} required />
              </ApiForm>
            </PanelBody>
          </Panel>
        </div>
      </SubscriptionContext>
    </SubscriptionPageContainer>
  );
}

export default withApi(withSubscription(withOrganization(RedeemPromoCode)));

const AccountCreditWrapper = styled('div')`
  width: 100%;
  display: flex;
  justify-content: flex-start;
  gap: ${space(1)};
  padding: 0 ${space(2)};
`;

const ItemContainer = styled('span')`
  margin: auto 0;
`;
