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
import TextBlock from '../components/text/textBlock';

const ENDPOINT = '/users/me/subscriptions/';

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
        subscribedDate: new Date(),
      };
      return {
        ...state,
        subscriptions: newSubscriptions,
      };
    });

    this.api.request(ENDPOINT, {
      method: 'PUT',
      data: {
        listId: subscription.listId,
        subscribed,
      },
      success: data => {
        IndicatorStore.addSuccess(
          `${subscribed ? 'Subscribed' : 'Unsubscribed'} to ${subscription.listName}`
        );
      },
      error: err => {
        IndicatorStore.addError(
          `Unable to ${subscribed ? '' : 'un'}subscribe to ${subscription.listName}`
        );
        this.setState({subscriptions: oldSubscriptions});
      },
    });
  };

  renderBody() {
    return (
      <div>
        <SettingsPageHeader title="Subscriptions" />
        <TextBlock>
          Sentry is committed to respecting your inbox. Our goal is to provide useful
          content and resources that make fixing errors less painful. Enjoyable even.
        </TextBlock>

        <TextBlock>
          As part of our compliance with the EU’s General Data Protection Regulation
          (GDPR), starting on 25 May 2018, we’ll only email you according to the marketing
          categories to which you’ve explicitly opted-in.
        </TextBlock>

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
              <Row p={2} align="center" key={subscription.listId}>
                <Box flex="1">
                  <SubscriptionName>{subscription.listName}</SubscriptionName>
                  {subscription.listDescription && (
                    <Description>{subscription.listDescription}</Description>
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
                        <DateTime shortDate date={subscription.subscribedDate} />
                      </div>
                    </SubscribedDescription>
                  )}
                </Flex>
              </Row>
            ))}
          </PanelBody>
        </Panel>
        <TextBlock>
          We’re applying GDPR consent and privacy policies to all Sentry contacts,
          regardless of location. You’ll be able to manage your subscriptions here and
          from an Unsubscribe link in the footer of all marketing emails.
        </TextBlock>

        <TextBlock>
          Please contact <a href="mailto:learn@sentry.io">learn@sentry.io</a> with any
          questions or suggestions.
        </TextBlock>
      </div>
    );
  }
}

export default AccountSubscriptions;
