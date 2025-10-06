import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import {IconList, IconSubscribed, IconTimer} from 'sentry/icons';
import {t} from 'sentry/locale';

import SubscriptionHeaderCard from 'getsentry/views/subscriptionPage/headerCards/subscriptionHeaderCard';

function LinksCard() {
  return (
    <SubscriptionHeaderCard
      title={t('Receipts & notifications')}
      sections={[
        <Flex key="links" direction="column" gap="sm" align="start">
          <LinkButton
            priority="link"
            icon={<IconList />}
            to="/settings/billing/receipts/"
          >
            {t('View all receipts')}
          </LinkButton>
          <LinkButton
            priority="link"
            icon={<IconTimer />}
            to="/settings/billing/usage-log/"
          >
            {t('View activity')}
          </LinkButton>
          <LinkButton
            priority="link"
            icon={<IconSubscribed />}
            to="/settings/billing/notifications/"
          >
            {t('Manage spend notifications')}
          </LinkButton>
        </Flex>,
      ]}
    />
  );
}

export default LinksCard;
