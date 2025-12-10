import {LinkButton} from '@sentry/scraps/button/linkButton';
import {Text} from '@sentry/scraps/text';

import {IconLock, IconUpload} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';

import {AddOnCategory, BillingType, type Subscription} from 'getsentry/types';
import {
  Cta,
  SeerCta,
} from 'getsentry/views/subscriptionPage/usageOverview/components/cta/base';

function UpgradeCta({
  organization,
  subscription,
  selectedProduct,
}: {
  organization: Organization;
  selectedProduct: DataCategory | AddOnCategory;
  subscription: Subscription;
}) {
  const isSalesAccount =
    // Invoiced subscriptions are managed by sales
    subscription.type === BillingType.INVOICED ||
    // Custom-priced subscriptions (price > 0) are managed by sales
    (subscription.customPrice !== null && subscription.customPrice > 0);

  if (selectedProduct === AddOnCategory.SEER) {
    return (
      <SeerCta
        action={
          subscription.canSelfServe ? (
            <LinkButton
              icon={<IconUpload />}
              priority="primary"
              href={`/checkout/${organization.slug}/?referrer=product-breakdown-panel`}
            >
              {t('Add to plan')}
            </LinkButton>
          ) : isSalesAccount ? (
            <Text variant="muted" size="sm">
              {tct('Contact us at [mailto:sales@sentry.io] to upgrade.', {
                mailto: <a href="mailto:sales@sentry.io" />,
              })}
            </Text>
          ) : (
            <Text variant="muted" size="sm">
              {tct('Contact us at [mailto:support@sentry.io] to upgrade.', {
                mailto: <a href="mailto:support@sentry.io" />,
              })}
            </Text>
          )
        }
      />
    );
  }

  return (
    <Cta
      icon={<IconLock locked size="sm" />}
      title={t('Upgrade required')}
      subtitle={tct('You currently do not have access to this feature. [action]', {
        action: subscription.canSelfServe
          ? t('Upgrade your plan to enable it.')
          : isSalesAccount
            ? tct('Contact us at [mailto:sales@sentry.io] to upgrade.', {
                mailto: <a href="mailto:sales@sentry.io" />,
              })
            : tct('Contact us at [mailto:support@sentry.io] to upgrade.', {
                mailto: <a href="mailto:support@sentry.io" />,
              }),
      })}
      action={
        subscription.canSelfServe ? (
          <LinkButton
            priority="primary"
            href={`/checkout/${organization.slug}/?referrer=product-breakdown-panel`}
          >
            {t('Upgrade now')}
          </LinkButton>
        ) : undefined
      }
      findOutMoreHref="https://docs.sentry.io/pricing/#pricing-by-product-and-data-category"
      hasContentBelow={false}
    />
  );
}

export default UpgradeCta;
