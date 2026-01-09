import {Fragment, useState} from 'react';

import seerConfigMainImg from 'sentry-images/spot/seer-config-main.svg';
import seerConfigSeerImg from 'sentry-images/spot/seer-config-seer.svg';

import {LinkButton} from '@sentry/scraps/button/linkButton';
import {Image} from '@sentry/scraps/image';
import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {IconLightning, IconLock, IconOpen, IconSeer, IconUpload} from 'sentry/icons';
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
import {checkIsAddOn, getBilledCategory, hasBillingAccess} from 'getsentry/utils/billing';
import {getPlanCategoryName} from 'getsentry/utils/dataCategory';
import {
  USAGE_OVERVIEW_PANEL_HEADER_HEIGHT,
  USAGE_OVERVIEW_PANEL_REFERRER,
} from 'getsentry/views/subscriptionPage/usageOverview/constants';

function Cta({
  image,
  imageAlt,
  icon,
  title,
  subtitle,
  buttons,
  heightOverride,
  isBanner,
}: {
  isBanner: boolean;
  subtitle: React.ReactNode;
  title: React.ReactNode;
  buttons?: React.ReactNode;
  heightOverride?: string;
  icon?: React.ReactNode;
} & ({image: string; imageAlt: string} | {image?: never; imageAlt?: never})) {
  return (
    <Flex
      background="secondary"
      padding="xl"
      direction={isBanner ? 'row' : 'column'}
      gap={isBanner ? {'2xs': 'xl', xl: '3xl'} : 'xl'}
      borderBottom={isBanner ? 'primary' : undefined}
      radius={isBanner ? '0 0 md md' : 'md'}
      align="center"
      justify={isBanner ? 'between' : 'center'}
      height={heightOverride ?? (isBanner ? undefined : '100%')}
    >
      <Flex direction="column" gap="lg" align={isBanner ? 'start' : 'center'}>
        {icon && <Flex align="center">{icon}</Flex>}
        {image && (
          <Flex align="center">
            <Container maxWidth="200px">
              <Image src={image} alt={imageAlt} />
            </Container>
          </Flex>
        )}
        <Text bold align={isBanner ? 'left' : 'center'} size="lg" textWrap="balance">
          {title}
        </Text>
        <Container maxWidth={{'2xs': '300px', xl: isBanner ? 'unset' : '300px'}}>
          <Text
            variant="muted"
            size="sm"
            align={isBanner ? 'left' : 'center'}
            textWrap="balance"
          >
            {subtitle}
          </Text>
        </Container>
      </Flex>
      {buttons && (
        <Flex
          direction="column"
          gap={isBanner ? 'sm' : 'lg'}
          align="center"
          flexGrow={isBanner ? 1 : undefined}
        >
          {buttons}
        </Flex>
      )}
    </Flex>
  );
}

function FindOutMoreButton({
  href,
  to,
  selectedProduct,
}: {
  selectedProduct: DataCategory | AddOnCategory;
} & ({href: string; to?: never} | {to: string; href?: never})) {
  return (
    <LinkButton
      icon={<IconOpen />}
      priority="link"
      size="sm"
      href={href}
      to={to ?? ''}
      analyticsEventName="Subscription Settings: Find Out More Button Clicked"
      analyticsEventKey="subscription_settings.find_out_more_button_clicked"
      analyticsParams={{product: selectedProduct}}
    >
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
        justifySelf="center"
        height="100%"
      >
        <Container>
          <Image src={seerConfigMainImg} alt="" />
        </Container>
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
  isBanner,
  potentialProductTrial,
}: {
  isBanner: boolean;
  organization: Organization;
  potentialProductTrial: ProductTrial;
  selectedProduct: DataCategory | AddOnCategory;
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
            style={isBanner ? {width: '100%'} : undefined}
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
          <FindOutMoreButton
            href="https://docs.sentry.io/pricing/#product-trials"
            selectedProduct={selectedProduct}
          />
        </Fragment>
      }
      isBanner={isBanner}
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
  const hasBillingPerms = hasBillingAccess(organization);

  if (selectedProduct === AddOnCategory.SEER) {
    return (
      <SeerCta
        action={
          hasBillingPerms ? (
            subscription.canSelfServe ? (
              <LinkButton
                icon={<IconUpload />}
                priority="primary"
                href={`/checkout/${organization.slug}/?referrer=${USAGE_OVERVIEW_PANEL_REFERRER}`}
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
          ) : (
            <Text variant="muted" size="sm">
              {t('Contact a billing admin to upgrade.')}
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
        action: hasBillingPerms
          ? subscription.canSelfServe
            ? t('Upgrade your plan to enable it.')
            : isSalesAccount
              ? tct('Contact us at [mailto:sales@sentry.io] to upgrade.', {
                  mailto: <a href="mailto:sales@sentry.io" />,
                })
              : tct('Contact us at [mailto:support@sentry.io] to upgrade.', {
                  mailto: <a href="mailto:support@sentry.io" />,
                })
          : t('Contact a billing admin to upgrade.'),
      })}
      buttons={
        subscription.canSelfServe && hasBillingPerms ? (
          <Fragment>
            <LinkButton
              priority="primary"
              href={`/checkout/${organization.slug}/?referrer=${USAGE_OVERVIEW_PANEL_REFERRER}`}
            >
              {t('Upgrade now')}
            </LinkButton>
            <FindOutMoreButton
              href="https://docs.sentry.io/pricing/#pricing-by-product-and-data-category"
              selectedProduct={selectedProduct}
            />
          </Fragment>
        ) : undefined
      }
      isBanner={false}
    />
  );
}

function SetupCta({
  selectedProduct,
  organization,
}: {
  organization: Organization;
  selectedProduct: DataCategory | AddOnCategory;
}) {
  // TODO(isabella): refactor this whole file to be more reusable
  if (selectedProduct !== AddOnCategory.SEER) {
    return null;
  }

  return (
    <Cta
      isBanner={false}
      image={seerConfigSeerImg}
      imageAlt=""
      title={t('Get started with Seer')}
      subtitle={t(
        'Finish connecting to GitHub, configure your repositories and projects, and start getting the most out of Seer.'
      )}
      heightOverride={`calc(100% - ${USAGE_OVERVIEW_PANEL_HEADER_HEIGHT})`}
      buttons={
        <LinkButton
          icon={<IconSeer />}
          href={`/settings/${organization.slug}/seer/?referrer=${USAGE_OVERVIEW_PANEL_REFERRER}`}
          priority="primary"
          analyticsEventName="Subscription Settings: Set Up Button Clicked"
          analyticsEventKey="subscription_settings.set_up_button_clicked"
          analyticsParams={{
            product: selectedProduct,
          }}
        >
          {t('Set Up Seer')}
        </LinkButton>
      }
    />
  );
}

export {ProductTrialCta, UpgradeCta, SetupCta};
