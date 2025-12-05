import {Fragment, useState} from 'react';

import {LinkButton} from '@sentry/scraps/button/linkButton';
import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {IconLightning, IconLock, IconOpen, IconUpload} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';

import StartTrialButton from 'getsentry/components/startTrialButton';
import {
  AddOnCategory,
  BillingType,
  type ProductTrial,
  type Subscription,
} from 'getsentry/types';
import {checkIsAddOn, getBilledCategory} from 'getsentry/utils/billing';
import {getPlanCategoryName} from 'getsentry/utils/dataCategory';

function Cta({
  icon,
  title,
  subtitle,
  buttons,
  hasContentBelow,
}: {
  hasContentBelow: boolean;
  subtitle: React.ReactNode;
  title: React.ReactNode;
  buttons?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <Flex
      background="secondary"
      padding="xl"
      direction="column"
      gap="xl"
      borderBottom={hasContentBelow ? 'primary' : undefined}
      radius={hasContentBelow ? undefined : '0 0 md md'}
      align="center"
      justify="center"
      height={hasContentBelow ? undefined : '100%'}
    >
      <Flex direction="column" gap="lg" align="center">
        {icon && (
          <Flex align="center" gap="sm">
            {icon}
          </Flex>
        )}
        <Text bold align="center" size="lg" textWrap="balance">
          {title}
        </Text>
        <Container maxWidth="300px">
          <Text variant="muted" size="sm" align="center" textWrap="balance">
            {subtitle}
          </Text>
        </Container>
      </Flex>
      {buttons && (
        <Flex direction="column" gap="lg" align="center">
          {buttons}
        </Flex>
      )}
    </Flex>
  );
}

function FindOutMoreButton({
  href,
  to,
}:
  | {
      href: string;
      to?: never;
    }
  | {
      to: string;
      href?: never;
    }) {
  return (
    <LinkButton icon={<IconOpen />} priority="link" size="sm" href={href} to={to ?? ''}>
      {t('Find out more')}
    </LinkButton>
  );
}

/**
 * Full panel CTA for Seer
 */
function SeerCta({action, footerText}: {action: React.ReactNode; footerText?: string}) {
  // TODO(isabella): If we ever extend the full panel CTA to other products, we should
  // add copy to BILLED_DATA_CATEGORY_INFO or serialize them in some endpoint
  return (
    <Container background="secondary" height="100%" radius="md" alignSelf="stretch">
      <Flex
        direction="column"
        gap="xl"
        align="center"
        justify="center"
        maxWidth="80%"
        justifySelf="center"
        height="100%"
      >
        <Flex direction="column" gap="md">
          <Text align="center" size="xl" bold>
            {t('Find and fix issues anywhere with Seer AI debugger')}
          </Text>
          <Text as="div" align="center" size="sm">
            {/* TODO(seer): serialize pricing info */}
            <Text>$40 </Text>
            <Text variant="muted">{t('per active contributor / month')}</Text>
          </Text>
        </Flex>
        {action}
        {footerText && (
          <Text align="center" variant="muted" size="sm">
            {footerText}
          </Text>
        )}
      </Flex>
    </Container>
  );
}

function ProductTrialCta({
  organization,
  subscription,
  selectedProduct,
  showBottomBorder,
  potentialProductTrial,
}: {
  organization: Organization;
  potentialProductTrial: ProductTrial;
  selectedProduct: DataCategory | AddOnCategory;
  showBottomBorder: boolean;
  subscription: Subscription;
}) {
  const [trialButtonBusy, setTrialButtonBusy] = useState(false);
  const billedCategory = getBilledCategory(subscription, selectedProduct);
  if (!billedCategory) {
    return null;
  }

  const isAddOn = checkIsAddOn(selectedProduct);
  const addOnInfo = isAddOn
    ? subscription.addOns?.[selectedProduct as AddOnCategory]
    : null;
  if (isAddOn && !addOnInfo) {
    return null;
  }

  const productName = isAddOn
    ? toTitleCase(addOnInfo!.productName, {allowInnerUpperCase: true})
    : getPlanCategoryName({
        plan: subscription.planDetails,
        category: billedCategory,
        title: true,
      });

  if (selectedProduct === AddOnCategory.SEER) {
    return (
      <SeerCta
        action={
          <StartTrialButton
            size="md"
            icon={<IconLightning />}
            organization={organization}
            source="usage-overview"
            requestData={{
              productTrial: {
                category: potentialProductTrial.category,
                reasonCode: potentialProductTrial.reasonCode,
              },
            }}
            priority="primary"
            handleClick={() => setTrialButtonBusy(true)}
            onTrialStarted={() => setTrialButtonBusy(true)}
            onTrialFailed={() => setTrialButtonBusy(false)}
            busy={trialButtonBusy}
            disabled={trialButtonBusy}
          >
            {t('Start 14 day free trial')}
          </StartTrialButton>
        }
        footerText={t(
          "Trial begins immediately. You won't be billed unless you upgrade after the trial ends."
        )}
      />
    );
  }

  return (
    <Cta
      title={tct('Try unlimited [productName], free for 14 days', {productName})}
      subtitle={t(
        'Trial starts immediately, no usage will be billed during this period.'
      )}
      buttons={
        <Fragment>
          <StartTrialButton
            size="md"
            icon={<IconLightning />}
            organization={organization}
            source="usage-overview"
            requestData={{
              productTrial: {
                category: potentialProductTrial.category,
                reasonCode: potentialProductTrial.reasonCode,
              },
            }}
            priority="primary"
            handleClick={() => setTrialButtonBusy(true)}
            onTrialStarted={() => setTrialButtonBusy(true)}
            onTrialFailed={() => setTrialButtonBusy(false)}
            busy={trialButtonBusy}
            disabled={trialButtonBusy}
          >
            {t('Activate free trial')}
          </StartTrialButton>
          <FindOutMoreButton href="https://docs.sentry.io/pricing/#product-trials" />
        </Fragment>
      }
      hasContentBelow={showBottomBorder}
    />
  );
}

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
      buttons={
        subscription.canSelfServe ? (
          <Fragment>
            <LinkButton
              priority="primary"
              href={`/checkout/${organization.slug}/?referrer=product-breakdown-panel`}
            >
              {t('Upgrade now')}
            </LinkButton>
            <FindOutMoreButton href="https://docs.sentry.io/pricing/#pricing-by-product-and-data-category" />
          </Fragment>
        ) : undefined
      }
      hasContentBelow={false}
    />
  );
}

export {ProductTrialCta, UpgradeCta};
