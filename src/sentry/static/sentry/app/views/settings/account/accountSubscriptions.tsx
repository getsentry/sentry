import React from 'react';
import styled from '@emotion/styled';
import moment from 'moment';
import groupBy from 'lodash/groupBy';

import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {t, tct} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import DateTime from 'app/components/dateTime';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import Switch from 'app/components/switch';
import space from 'app/styles/space';
import TextBlock from 'app/views/settings/components/text/textBlock';
import {IconToggle} from 'app/icons';

const ENDPOINT = '/users/me/subscriptions/';

type Subscription = {
  email: string;
  listDescription: string;
  listId: number;
  listName: string;
  subscribed: boolean;
  subscribedDate: string | null;
  unsubscribedDate: string | null;
};

type State = AsyncView['state'] & {
  subscriptions: Subscription[];
};

class AccountSubscriptions extends AsyncView<AsyncView['props'], State> {
  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    return [['subscriptions', ENDPOINT]];
  }

  getTitle() {
    return 'Subscriptions';
  }

  handleToggle = (subscription: Subscription, index: number, _e: React.MouseEvent) => {
    const subscribed = !subscription.subscribed;
    const oldSubscriptions = this.state.subscriptions;

    this.setState(state => {
      const newSubscriptions = state.subscriptions.slice();
      newSubscriptions[index] = {
        ...subscription,
        subscribed,
        subscribedDate: new Date().toString(),
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
    const subGroups = Object.entries(groupBy(this.state.subscriptions, sub => sub.email));

    return (
      <div>
        <SettingsPageHeader title="Subscriptions" />
        <TextBlock>
          {t(`Sentry is committed to respecting your inbox. Our goal is to
              provide useful content and resources that make fixing errors less
              painful. Enjoyable even.`)}
        </TextBlock>

        <TextBlock>
          {t(`As part of our compliance with the EU’s General Data Protection
              Regulation (GDPR), starting on 25 May 2018, we’ll only email you
              according to the marketing categories to which you’ve explicitly
              opted-in.`)}
        </TextBlock>

        <Panel>
          {this.state.subscriptions.length ? (
            <div>
              <PanelHeader>{t('Subscription')}</PanelHeader>
              <PanelBody>
                {subGroups.map(([email, subscriptions]) => (
                  <React.Fragment key={email}>
                    {subGroups.length > 1 && (
                      <Heading>
                        <IconToggle /> {t('Subscriptions for %s', email)}
                      </Heading>
                    )}

                    {subscriptions.map((subscription, index) => (
                      <PanelItem p={2} alignItems="center" key={subscription.listId}>
                        <SubscriptionDetails>
                          <SubscriptionName>{subscription.listName}</SubscriptionName>
                          {subscription.listDescription && (
                            <Description>{subscription.listDescription}</Description>
                          )}
                          {subscription.subscribed ? (
                            <SubscribedDescription>
                              <div>
                                {tct('[email] on [date]', {
                                  email: subscription.email,
                                  date: (
                                    <DateTime
                                      shortDate
                                      date={moment(subscription.subscribedDate!)}
                                    />
                                  ),
                                })}
                              </div>
                            </SubscribedDescription>
                          ) : (
                            <SubscribedDescription>
                              {t('Not currently subscribed')}
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
                    ))}
                  </React.Fragment>
                ))}
              </PanelBody>
            </div>
          ) : (
            <EmptyMessage>{t("There's no subscription backend present.")}</EmptyMessage>
          )}
        </Panel>
        <TextBlock>
          {t(`We’re applying GDPR consent and privacy policies to all Sentry
              contacts, regardless of location. You’ll be able to manage your
              subscriptions here and from an Unsubscribe link in the footer of
              all marketing emails.`)}
        </TextBlock>

        <TextBlock>
          {tct(
            'Please contact [email:learn@sentry.io] with any questions or suggestions.',
            {email: <a href="mailto:learn@sentry.io" />}
          )}
        </TextBlock>
      </div>
    );
  }
}

const Heading = styled(PanelItem)`
  display: grid;
  grid-template-columns: max-content 1fr;
  grid-gap: ${space(1)};
  align-items: center;
  font-size: ${p => p.theme.fontSizeMedium};
  padding: ${space(1.5)} ${space(2)};
  background: ${p => p.theme.backgroundSecondary};
  color: ${p => p.theme.subText};
`;

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
  color: ${p => p.theme.subText};
`;

const SubscribedDescription = styled(Description)`
  color: ${p => p.theme.gray300};
`;

export default AccountSubscriptions;
