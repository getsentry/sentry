import {Fragment} from 'react';
import styled from '@emotion/styled';
import groupBy from 'lodash/groupBy';
import orderBy from 'lodash/orderBy';
import moment from 'moment';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import DateTime from 'sentry/components/dateTime';
import EmptyMessage from 'sentry/components/emptyMessage';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PanelItem from 'sentry/components/panels/panelItem';
import Switch from 'sentry/components/switchButton';
import {IconToggle} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import DeprecatedAsyncView from 'sentry/views/deprecatedAsyncView';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

const ENDPOINT = '/users/me/subscriptions/';

export type Subscription = {
  email: string;
  listDescription: string;
  listId: number;
  listName: string;
  subscribed: boolean;
  subscribedDate: string | null;
  unsubscribedDate: string | null;
};

type State = DeprecatedAsyncView['state'] & {
  subscriptions: Subscription[];
};

class AccountSubscriptions extends DeprecatedAsyncView<
  DeprecatedAsyncView['props'],
  State
> {
  getEndpoints(): ReturnType<DeprecatedAsyncView['getEndpoints']> {
    return [['subscriptions', ENDPOINT]];
  }

  getTitle() {
    return t('Subscriptions');
  }

  handleToggle = (
    subscription: Subscription,
    email: string,
    listId: number,
    _e: React.MouseEvent
  ) => {
    const subscribed = !subscription.subscribed;
    const oldSubscriptions = this.state.subscriptions;

    this.setState(state => {
      const newSubscriptions = [...state.subscriptions];
      const index = newSubscriptions.findIndex(
        sub => sub.listId === listId && sub.email === email
      );
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
    // Group by does not guarantee order, so we sort by email
    const subGroups = orderBy(
      Object.entries(groupBy(this.state.subscriptions, sub => sub.email)),
      ([email]) => email
    );

    return (
      <div>
        <SettingsPageHeader title={this.getTitle()} />
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
                  <Fragment key={email}>
                    {subGroups.length > 1 && (
                      <Heading>
                        <IconToggle /> {t('Subscriptions for %s', email)}
                      </Heading>
                    )}

                    {subscriptions
                      .sort((a, b) => a.listId - b.listId)
                      .map(subscription => (
                        <PanelItem center key={subscription.listId}>
                          <SubscriptionDetails
                            htmlFor={`${subscription.email}-${subscription.listId}`}
                            aria-label={subscription.listName}
                          >
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
                              id={`${subscription.email}-${subscription.listId}`}
                              isActive={subscription.subscribed}
                              size="lg"
                              toggle={this.handleToggle.bind(
                                this,
                                subscription,
                                email,
                                subscription.listId
                              )}
                            />
                          </div>
                        </PanelItem>
                      ))}
                  </Fragment>
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
  gap: ${space(1)};
  align-items: center;
  font-size: ${p => p.theme.fontSizeMedium};
  padding: ${space(1.5)} ${space(2)};
  background: ${p => p.theme.backgroundSecondary};
  color: ${p => p.theme.subText};
`;

const SubscriptionDetails = styled('label')`
  font-weight: initial;
  padding-right: ${space(2)};
  width: 85%;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    width: 75%;
  }
  @media (min-width: ${p => p.theme.breakpoints.large}) {
    width: 50%;
  }
`;

const SubscriptionName = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
`;
const Description = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  margin-top: ${space(0.5)};
`;

const SubscribedDescription = styled(Description)`
  color: ${p => p.theme.subText};
`;

export default AccountSubscriptions;
