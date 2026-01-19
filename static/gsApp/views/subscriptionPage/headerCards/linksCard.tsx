import {Fragment} from 'react';

import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import {IconList, IconSubscribed, IconTimer} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';

import SubscriptionHeaderCard from 'getsentry/views/subscriptionPage/headerCards/subscriptionHeaderCard';
import {hasSpendVisibilityNotificationsFeature} from 'getsentry/views/subscriptionPage/utils';

function LinksCard({organization}: {organization: Organization}) {
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
                priority="link"
                icon={<IconList />}
                to={`/settings/${organization.slug}/billing/receipts/`}
                size="xs"
              >
                {t('View all receipts')}
              </LinkButton>
              <LinkButton
                priority="link"
                icon={<IconTimer />}
                to={`/settings/${organization.slug}/billing/activity-logs/`}
                size="xs"
              >
                {t('View activity')}
              </LinkButton>
              {hasSpendNotifications && (
                <LinkButton
                  priority="link"
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
              priority="link"
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

export default LinksCard;
