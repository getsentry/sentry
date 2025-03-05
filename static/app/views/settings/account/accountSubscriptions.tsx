import {Fragment} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Switch} from 'sentry/components/core/switch';
import {DateTime} from 'sentry/components/dateTime';
import EmptyMessage from 'sentry/components/emptyMessage';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PanelItem from 'sentry/components/panels/panelItem';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconSliders} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  setApiQueryData,
  useApiQuery,
  useMutation,
  useQueryClient,
} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
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

function AccountSubscriptions() {
  const {
    data: subscriptions = [],
    isPending,
    isError,
    refetch,
  } = useApiQuery<Subscription[]>([ENDPOINT], {
    staleTime: 2 * 60 * 1000,
  });

  const queryClient = useQueryClient();
  const api = useApi();

  const {mutate: updateSubscription} = useMutation({
    mutationFn: (data: Subscription) =>
      api.requestPromise(ENDPOINT, {
        method: 'PUT',
        data,
      }),
    onSuccess: (_resp, subscription: Subscription) => {
      addSuccessMessage(
        `${subscription.subscribed ? 'Subscribed' : 'Unsubscribed'} to ${subscription.listName}`
      );

      // Update the subscription in the list
      setApiQueryData<Subscription[]>(queryClient, [ENDPOINT], subs => {
        return subs?.map(sub => {
          if (sub.listId === subscription.listId) {
            return subscription;
          }

          return sub;
        });
      });
    },
    onError: (subscription: Subscription) => {
      if (subscription) {
        addErrorMessage(
          `Unable to ${subscription.subscribed ? '' : 'un'}subscribe to ${subscription.listName}`
        );
      } else {
        addErrorMessage('An unknown error occurred, please try again later.');
      }
    },
  });

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return (
      <LoadingError
        onRetry={() => {
          refetch();
        }}
      />
    );
  }

  const subGroups = Object.entries(
    subscriptions.reduce<Record<string, Subscription[]>>((acc, sub) => {
      (acc[sub.email] = acc[sub.email] || []).push(sub);
      return acc;
    }, {})
  );

  subGroups.sort(([a], [b]) => a[0]?.localeCompare(b[0]!)!);

  const handleToggle = (subscription: Subscription) => {
    const subscribed = !subscription.subscribed;

    updateSubscription({
      ...subscription,
      subscribed,
    });
  };

  const subscriptionText = t('Subscriptions');
  return (
    <div>
      <SentryDocumentTitle title={subscriptionText} />
      <SettingsPageHeader title={subscriptionText} />

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
        {subscriptions?.length ? (
          <div>
            <PanelHeader>{t('Subscription')}</PanelHeader>
            <PanelBody>
              {subGroups.map(([email, subs]) => (
                <Fragment key={email}>
                  {subGroups.length > 1 && (
                    <Heading>
                      <IconSliders /> {t('Subscriptions for %s', email)}
                    </Heading>
                  )}

                  {subs
                    .sort((a, b) => a.listId - b.listId)
                    .map((subscription, i) => (
                      <PanelItem center key={`${email}-${subscription.listId}-${i}`}>
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
                                      date={moment(subscription.subscribedDate)}
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
                            toggle={() => handleToggle(subscription)}
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
