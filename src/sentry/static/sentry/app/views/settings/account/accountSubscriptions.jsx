import {Box} from 'grid-emotion';
import React from 'react';
import styled from 'react-emotion';

import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import DateTime from 'app/components/dateTime';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import Switch from 'app/components/switch';
import IndicatorStore from 'app/stores/indicatorStore';
import TextBlock from 'app/views/settings/components/text/textBlock';
import EmptyMessage from 'app/views/settings/components/emptyMessage';

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
  color: ${p => p.theme.gray2};
`;

class AccountSubscriptions extends AsyncView {
  getEndpoints() {
    return [['subscriptions', ENDPOINT]];
  }

  getTitle() {
    return 'Subscriptions';
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
          {this.state.subscriptions.length ? (
            <div>
              <PanelHeader>{t('Subscription')}</PanelHeader>
              <PanelBody>
                {this.state.subscriptions.map((subscription, index) => (
                  <PanelItem p={2} align="center" key={subscription.listId}>
                    <Box w={1 / 2} pr={2}>
                      <SubscriptionName>{subscription.listName}</SubscriptionName>
                      {subscription.listDescription && (
                        <Description>{subscription.listDescription}</Description>
                      )}
                      {subscription.subscribed ? (
                        <SubscribedDescription>
                          <div>
                            {subscription.email} on{' '}
                            <DateTime shortDate date={subscription.subscribedDate} />
                          </div>
                        </SubscribedDescription>
                      ) : (
                        <SubscribedDescription>
                          Not currently subscribed
                        </SubscribedDescription>
                      )}
                    </Box>
                    <Box>
                      <Switch
                        isActive={subscription.subscribed}
                        size="lg"
                        toggle={this.handleToggle.bind(this, subscription, index)}
                      />
                    </Box>
                  </PanelItem>
                ))}{' '}
              </PanelBody>
            </div>
          ) : (
            <EmptyMessage>{t("There's no subscription backend present.")}</EmptyMessage>
          )}
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
