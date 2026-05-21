import {Fragment} from 'react';

import {LinkButton} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {IconList, IconSubscribed, IconTimer} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';

import {SubscriptionHeaderCard} from 'getsentry/views/subscriptionPage/headerCards/subscriptionHeaderCard';
import {hasSpendVisibilityNotificationsFeature} from 'getsentry/views/subscriptionPage/utils';

export function LinksCard({organization}: {organization: Organization}) {
  const hasBillingPerms = organization.access?.includes('org:billing');
  const hasSpendNotifications = hasSpendVisibilityNotificationsFeature(organization);

  return (
    <SubscriptionHeaderCard
      title={hasBillingPerms ? t('Receipts & notifications') : t('Activity log')}
      sections={[
        <Flex key="links" direction="column" gap="sm" align="start">
          {hasBillingPerms ? (
            <Fragment>
              <LinkButton
                variant="link"
                icon={<IconList />}
                to={`/settings/${organization.slug}/billing/receipts/`}
                size="xs"
              >
                {t('View all receipts')}
              </LinkButton>
              <LinkButton
                variant="link"
                icon={<IconTimer />}
                to={`/settings/${organization.slug}/billing/activity-logs/`}
                size="xs"
              >
                {t('View activity')}
              </LinkButton>
              {hasSpendNotifications && (
                <LinkButton
                  variant="link"
                  icon={<IconSubscribed />}
                  to={`/settings/${organization.slug}/billing/notifications/`}
                  size="xs"
                >
                  {t('Manage spend notifications')}
                </LinkButton>
              )}
            </Fragment>
          ) : (
            <LinkButton
              variant="link"
              icon={<IconTimer />}
              to={`/settings/${organization.slug}/billing/activity-logs/`}
              size="xs"
            >
              {t('View activity')}
            </LinkButton>
          )}
        </Flex>,
      ]}
    />
  );
}
