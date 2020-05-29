import React from 'react';
import styled from '@emotion/styled';

import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import DateTime from 'app/components/dateTime';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import Switch from 'app/components/switch';
import space from 'app/styles/space';
import TextBlock from 'app/views/settings/components/text/textBlock';

const ENDPOINT = '/users/me/subscriptions/';

class AccountSubscriptions extends AsyncView {
  getEndpoints() {
    return [['subscriptions', ENDPOINT]];
  }

  getTitle() {
    return 'Subscriptions';
  }

  handleToggle = (subscription, index, _e) => {
    const subscribed = !subscription.subscribed;
    const oldSubscriptions = this.state.subscriptions;

    this.setState(state => {
      const newSubscriptions = state.subscriptions.slice();
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
      success: () => {
        addSuccessMessage(
          `${subscribed ? 'Subscribed' : 'Unsubscribed'} to ${subscription.listName}`
        );
      },
      error: () => {
        addErrorMessage(
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
                  <PanelItem p={2} alignItems="center" key={subscription.listId}>
                    <SubscriptionDetails>
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
                    </SubscriptionDetails>
                    <div>
                      <Switch
                        isActive={subscription.subscribed}
                        size="lg"
                        toggle={this.handleToggle.bind(this, subscription, index)}
                      />
                    </div>
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

const SubscriptionDetails = styled('div')`
  width: 50%;
  padding-right: ${space(2)};
`;

const SubscriptionName = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
`;
const Description = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  margin-top: ${space(0.75)};
  color: ${p => p.theme.gray600};
`;

const SubscribedDescription = styled(Description)`
  color: ${p => p.theme.gray500};
`;

export default AccountSubscriptions;
