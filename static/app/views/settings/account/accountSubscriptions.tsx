import {Fragment} from 'react';
import {mutationOptions} from '@tanstack/react-query';
import moment from 'moment-timezone';
import {z} from 'zod';

import {AutoSaveField, FieldGroup, FormSearch} from '@sentry/scraps/form';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import EmptyMessage from 'sentry/components/emptyMessage';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconSliders} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {
  fetchMutation,
  setApiQueryData,
  useApiQuery,
  useQueryClient,
} from 'sentry/utils/queryClient';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

const ENDPOINT = getApiUrl('/users/$userId/subscriptions/', {path: {userId: 'me'}});

const subscriptionSchema = z.object({
  subscribed: z.boolean(),
});

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

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  const subGroups = Object.entries(
    subscriptions.reduce<Record<string, Subscription[]>>((acc, sub) => {
      (acc[sub.email] = acc[sub.email] || []).push(sub);
      return acc;
    }, {})
  );

  subGroups.sort(([a], [b]) => a[0]?.localeCompare(b[0]!)!);

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
        {t(`As part of our compliance with the EU's General Data Protection
              Regulation (GDPR), starting on 25 May 2018, we'll only email you
              according to the marketing categories to which you've explicitly
              opted-in.`)}
      </TextBlock>

      {subscriptions.length ? (
        <FormSearch route="/settings/account/subscriptions/">
          {subGroups.map(([email, subs]) => (
            <FieldGroup
              key={email}
              title={
                subGroups.length > 1 ? (
                  <Flex gap="sm" align="center">
                    <IconSliders />
                    <Text>{t('Subscriptions for %s', email)}</Text>
                  </Flex>
                ) : (
                  t('Subscription')
                )
              }
            >
              {subs
                .sort((a, b) => a.listId - b.listId)
                .map((subscription, i) => {
                  const subMutationOptions = mutationOptions({
                    mutationFn: (data: z.infer<typeof subscriptionSchema>) =>
                      fetchMutation({
                        url: ENDPOINT,
                        method: 'PUT',
                        data: {...subscription, ...data},
                      }),
                    onSuccess: (_, variables) => {
                      addSuccessMessage(
                        `${variables.subscribed ? 'Subscribed' : 'Unsubscribed'} to ${subscription.listName}`
                      );
                      setApiQueryData<Subscription[]>(
                        queryClient,
                        [ENDPOINT],
                        cachedSubs =>
                          cachedSubs?.map(sub =>
                            sub.listId === subscription.listId
                              ? {...sub, ...variables}
                              : sub
                          )
                      );
                    },
                    onError: () => {
                      addErrorMessage(
                        `Unable to ${subscription.subscribed ? 'un' : ''}subscribe to ${subscription.listName}`
                      );
                    },
                  });

                  return (
                    <AutoSaveField
                      key={`${email}-${subscription.listId}-${i}`}
                      name="subscribed"
                      schema={subscriptionSchema}
                      initialValue={subscription.subscribed}
                      mutationOptions={subMutationOptions}
                    >
                      {field => {
                        const isSubscribed = field.state.value;
                        const statusText = isSubscribed
                          ? subscription.subscribedDate
                            ? `${subscription.email} on ${moment(subscription.subscribedDate).format('ll')}`
                            : undefined
                          : t('You are currently unsubscribed from this list.');

                        const hintText =
                          subscription.listDescription || statusText ? (
                            <Fragment>
                              {subscription.listDescription}
                              {subscription.listDescription && statusText ? <br /> : null}
                              {statusText}
                            </Fragment>
                          ) : undefined;

                        return (
                          <field.Layout.Row
                            label={subscription.listName}
                            hintText={hintText}
                          >
                            <field.Switch
                              checked={field.state.value}
                              onChange={field.handleChange}
                            />
                          </field.Layout.Row>
                        );
                      }}
                    </AutoSaveField>
                  );
                })}
            </FieldGroup>
          ))}
        </FormSearch>
      ) : (
        <Panel>
          <EmptyMessage>{t("There's no subscription backend present.")}</EmptyMessage>
        </Panel>
      )}

      <TextBlock>
        {t(`We're applying GDPR consent and privacy policies to all Sentry
              contacts, regardless of location. You'll be able to manage your
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

export default AccountSubscriptions;
