import {Fragment} from 'react';

import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import {IconList, IconSubscribed, IconTimer} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';

import SubscriptionHeaderCard from 'getsentry/views/subscriptionPage/headerCards/subscriptionHeaderCard';

function LinksCard({organization}: {organization: Organization}) {
  const hasBillingPerms = organization.access?.includes('org:billing');

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
                to="/settings/billing/receipts/"
              >
                <Text size="sm" variant="accent">
                  {t('View all receipts')}
                </Text>
              </LinkButton>
              <LinkButton
                priority="link"
                icon={<IconTimer />}
                to="/settings/billing/usage-log/"
              >
                <Text size="sm" variant="accent">
                  {t('View activity')}
                </Text>
              </LinkButton>
              <LinkButton
                priority="link"
                icon={<IconSubscribed />}
                to="/settings/billing/notifications/"
              >
                <Text size="sm" variant="accent">
                  {t('Manage spend notifications')}
                </Text>
              </LinkButton>
            </Fragment>
          ) : (
            <LinkButton
              priority="link"
              icon={<IconTimer />}
              to="/settings/billing/usage-log/"
            >
              <Text size="sm" variant="accent">
                {t('View activity')}
              </Text>
            </LinkButton>
          )}
        </Flex>,
      ]}
    />
  );
}

export default LinksCard;
