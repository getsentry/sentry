import {Box, Flex} from 'grid-emotion';
import React from 'react';
import styled from 'react-emotion';

import {t} from '../../../locale';
import AsyncView from '../../asyncView';
import DateTime from '../../../components/dateTime';
import Panel from '../components/panel';
import PanelBody from '../components/panelBody';
import PanelHeader from '../components/panelHeader';
import Row from '../components/row';
import SettingsPageHeader from '../components/settingsPageHeader';
import Switch from '../../../components/switch';
import IndicatorStore from '../../../stores/indicatorStore';

const ENDPOINT = '/account/subscriptions/';

const SubscriptionName = styled.div`
  font-size: 1.2em;
`;
const Description = styled.div`
  font-size: 0.8em;
  margin-top: 6px;
  color: ${p => p.theme.gray3};
`;

const SubscribedDescription = styled(Description)`
  text-align: right;
`;

class AccountSubscriptions extends AsyncView {
  getEndpoints() {
    return [['subscriptions', ENDPOINT]];
  }

  handleToggle = (subscription, index, e) => {
    let subscribed = !subscription.subscribed;
    let oldSubscriptions = this.state.subscriptions;

    this.setState(state => {
      let newSubscriptions = state.subscriptions.slice();
      newSubscriptions[index] = {
        ...subscription,
        subscribed,
        subscribed_date: new Date(),
      };
      return {
        ...state,
        subscriptions: newSubscriptions,
      };
    });

    this.api.request(ENDPOINT, {
      method: 'PUT',
      data: {
        list_id: subscription.list_id,
        subscribed,
      },
      success: data => {
        IndicatorStore.addSuccess(
          `${subscribed ? 'Subscribed' : 'Unsubscribed'} to ${subscription.list_name}`
        );
      },
      error: err => {
        IndicatorStore.addError(
          `Unable to ${subscribed ? '' : 'un'}subscribe to ${subscription.list_name}`
        );
        this.setState({subscriptions: oldSubscriptions});
      },
    });
  };

  renderBody() {
    return (
      <div>
        <SettingsPageHeader label="Subscriptions" />
        <p>
          Sentry is committed to respecting your inbox. Our goal is to provide useful
          content and resources that make fixing errors less painful. Enjoyable even.
        </p>

        <p>
          As part of our compliance with the EU’s General Data Protection Regulation
          (GDPR), starting on 25 May 2018, we’ll only email you according to the marketing
          categories to which you’ve explicitly opted-in.
        </p>

        <Panel>
          <PanelHeader disablePadding>
            <Flex align="center">
              <Box px={2} flex="1">
                {t('Name')}
              </Box>
              <Box px={2}>{t('Subscribed')}</Box>
            </Flex>
          </PanelHeader>

          <PanelBody>
            {this.state.subscriptions.map((subscription, index) => (
              <Row p={2} align="center" key={subscription.list_id}>
                <Box flex="1">
                  <SubscriptionName>{subscription.list_name}</SubscriptionName>
                  {subscription.list_description && (
                    <Description>{subscription.list_description}</Description>
                  )}
                </Box>
                <Flex direction="column" align="flex-end">
                  <Switch
                    isActive={subscription.subscribed}
                    size="lg"
                    toggle={this.handleToggle.bind(this, subscription, index)}
                  />
                  {subscription.subscribed && (
                    <SubscribedDescription>
                      <div>{subscription.email} on </div>
                      <div>
                        <DateTime shortDate date={subscription.subscribed_date} />
                      </div>
                    </SubscribedDescription>
                  )}
                </Flex>
              </Row>
            ))}
          </PanelBody>
        </Panel>
        <p>
          We’re applying GDPR consent and privacy policies to all Sentry contacts,
          regardless of location. You’ll be able to manage your subscriptions here and
          from an Unsubscribe link in the footer of all marketing emails.
        </p>

        <p>
          Please contact <a href="mailto:learn@sentry.io">learn@sentry.io</a> with any
          questions or suggestions.
        </p>
      </div>
    );
  }
}

export default AccountSubscriptions;
