import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
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
        </Flex>,
      ]}
    />
  );
}

export default LinksCard;
