import {Fragment, useCallback, useEffect} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/alert';
import type {ButtonProps} from 'sentry/components/button';
import {Button} from 'sentry/components/button';
import {IconClose, IconInfo, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import useDismissAlert from 'sentry/utils/useDismissAlert';

import {openAM2ProfilingUpsellModal} from 'getsentry/actionCreators/modal';
import withSubscription from 'getsentry/components/withSubscription';
import type {Subscription} from 'getsentry/types';
import {PlanTier} from 'getsentry/types';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';

export function makeLinkToOwnersAndBillingMembers(
  organization: Organization,
  referrer: string
) {
  return `/settings/${organization.slug}/members/?referrer=${referrer}&query=role%3Abilling+role%3Aowner`;
}

export function makeLinkToManageSubscription(
  organization: Organization,
  referrer: string
) {
  return `/settings/${organization.slug}/billing/overview/?referrer=${referrer}`;
}

function makeAnalyticsProps(
  organization: AlertProps['organization'],
  subscription: AlertProps['subscription']
) {
  return {
    organization,
    surface: 'profiling' as const,
    planTier: subscription.planTier,
    canSelfServe: subscription.canSelfServe,
    channel: subscription.channel,
    has_billing_scope: organization.access?.includes('org:billing'),
  };
}

function trackOpenModal({organization, subscription}: AlertProps) {
  trackGetsentryAnalytics(
    'upgrade_now.alert.open_modal',
    makeAnalyticsProps(organization, subscription)
  );
}

function trackPageView({organization, subscription}: AlertProps) {
  trackGetsentryAnalytics(
    'upgrade_now.alert.viewed',
    makeAnalyticsProps(organization, subscription)
  );
}

function trackDismiss({organization, subscription}: AlertProps) {
  trackGetsentryAnalytics(
    'upgrade_now.alert.dismiss',
    makeAnalyticsProps(organization, subscription)
  );
}

function trackManageSubscriptionClicked({organization, subscription}: AlertProps) {
  trackGetsentryAnalytics(
    'upgrade_now.alert.manage_sub',
    makeAnalyticsProps(organization, subscription)
  );
}

interface AlertProps {
  organization: Organization;
  subscription: Subscription;
}

interface GraceAlertProps {
  action: {
    label: string;
    onClick?: () => void;
    to?: string | Record<PropertyKey, unknown>;
  };
  children: React.ReactNode;
  dismiss: undefined | (() => void);
  disableAction?: boolean;
  type?: 'error';
}

function GraceAlert({children, action, dismiss, type, disableAction}: GraceAlertProps) {
  const trailingItems = (
    <Fragment>
      <StyledButton
        size="xs"
        onClick={action.onClick}
        to={action.to}
        disabled={disableAction}
      >
        {action.label}
      </StyledButton>
      {dismiss ? (
        <StyledButton priority="link" size="sm" onClick={dismiss}>
          <IconClose color="gray500" size="sm" />
        </StyledButton>
      ) : null}
    </Fragment>
  );

  return (
    <StyledAlert
      icon={type ? <IconWarning /> : dismiss ? <IconInfo /> : <IconWarning />}
      opaque={false}
      showIcon
      system
      trailingItems={trailingItems}
      type={type ? type : dismiss ? 'info' : 'error'}
    >
      {children}
    </StyledAlert>
  );
}

const StyledAlert = styled(Alert)`
  margin: 0;
`;

const StyledButton = styled(Button)`
  color: inherit;
`;

interface GenericGraceAlertProps extends AlertProps {
  action: (props: any) => {
    label: string;
    onClick?: () => void;
    to?: string | Record<PropertyKey, unknown>;
  };
  children: React.ReactNode;
  dismissKey: string;
  dismissable: boolean;
  disableAction?: boolean;
}

function GenericGraceAlert(props: GenericGraceAlertProps) {
  const {dismiss, isDismissed} = useDismissAlert({
    key: props.dismissKey,
    expirationDays: 14,
  });

  const onDismiss = useCallback(() => {
    dismiss();
    trackDismiss(props);
  }, [dismiss, props]);

  useEffect(() => {
    if (!isDismissed) {
      trackPageView(props);
    }
  }, [props, isDismissed]);

  if (isDismissed && props.dismissable) {
    return null;
  }

  return (
    <GraceAlert
      action={props.action({dismiss: onDismiss})}
      dismiss={props.dismissable ? onDismiss : undefined}
      disableAction={props.disableAction}
    >
      {props.children}
    </GraceAlert>
  );
}

// Beta users on AM1 - explain that free ingestion will stop
// Users to be told that free profiling ingestion will end post-launch;
// and they will need to upgrade to AM2 to continue using profiling.
function ProfilingAM1BetaUserGraceAlert({organization, subscription}: AlertProps) {
  const userCanUpgrade = organization.access?.includes('org:billing');

  return (
    <GenericGraceAlert
      // If ingestion has not been stopped, the alert can be dismissed
      dismissable={false}
      dismissKey={`${organization.id}:dismiss-profiling-beta-am1-stopped-ingestion`}
      action={({dismiss}) => {
        if (subscription.canSelfServe) {
          if (userCanUpgrade) {
            return {
              label: t('Update Plan'),
              onClick: () => {
                openAM2ProfilingUpsellModal({
                  organization,
                  subscription,
                  onComplete: dismiss,
                });
                trackOpenModal({organization, subscription});
              },
            };
          }
          return {
            label: t('See who can update'),
            to: makeLinkToOwnersAndBillingMembers(
              organization,
              'profiling_onboard_am1-alert'
            ),
            onClick: () => trackManageSubscriptionClicked({organization, subscription}),
          };
        }
        return {
          label: t('Manage subscription'),
          to: makeLinkToManageSubscription(organization, 'profiling_onboard_am1-alert'),
          onClick: () => trackManageSubscriptionClicked({organization, subscription}),
        };
      }}
      organization={organization}
      subscription={subscription}
    >
      {t(
        'The profiling beta has now ended, and this organization is unable to ingest new profiles. Existing data will expire per our retention policy. To continue using profiling, update to the latest version of your plan.'
      )}
    </GenericGraceAlert>
  );
}

// Wrappers switch the different alerts to show for users on the AM1 plan.
function ProfilingAM1Alerts({organization, subscription}: AlertProps) {
  if (organization.features.includes('profiling-beta')) {
    return (
      <ProfilingAM1BetaUserGraceAlert
        organization={organization}
        subscription={subscription}
      />
    );
  }

  return null;
}

interface ProfilingBetaAlertBannerProps {
  organization: Organization;
  subscription: Subscription;
}

function ProfilingBetaAlertBannerComponent(props: ProfilingBetaAlertBannerProps) {
  const ComponentToShow =
    props.subscription.planTier === PlanTier.AM1 ? ProfilingAM1Alerts : null;

  return ComponentToShow ? (
    <ComponentToShow
      organization={props.organization}
      subscription={props.subscription}
    />
  ) : null;
}

export const ProfilingBetaAlertBanner = withSubscription(
  ProfilingBetaAlertBannerComponent,
  {noLoader: true}
);

type UpgradePlanButtonProps = ButtonProps & {
  children: React.ReactNode;
  fallback: React.ReactNode;
  organization: Organization;
  subscription: Subscription;
};

const hidePromptTiers: string[] = [PlanTier.AM2, PlanTier.AM3];

function UpgradePlanButton(props: UpgradePlanButtonProps) {
  const {subscription, organization, ...buttonProps} = props;

  if (hidePromptTiers.includes(subscription.planTier)) {
    return <Fragment>{props.fallback}</Fragment>;
  }

  const userCanUpgradePlan = organization.access?.includes('org:billing');

  if (subscription.canSelfServe) {
    if (userCanUpgradePlan) {
      return (
        <Button
          {...buttonProps}
          onClick={evt => {
            openAM2ProfilingUpsellModal({
              organization,
              subscription,
            });
            trackOpenModal({organization, subscription});
            props.onClick?.(evt);
          }}
        >
          {t('Update Plan')}
        </Button>
      );
    }
    return (
      <Button
        {...buttonProps}
        to={makeLinkToOwnersAndBillingMembers(
          organization,
          `profiling_onboard_${
            subscription.planTier === PlanTier.AM1 ? 'am1' : 'mmx'
          }-alert`
        )}
        onClick={() => trackManageSubscriptionClicked({organization, subscription})}
      >
        {t('See who can update')}
      </Button>
    );
  }
  return (
    <Button
      {...buttonProps}
      to={`/settings/${organization.slug}/billing/overview/?referrer=profiling_onboard_${
        subscription.planTier === PlanTier.AM1 ? 'am1' : 'mmx'
      }-alert`}
      onClick={() => trackManageSubscriptionClicked({organization, subscription})}
    >
      {t('Manage subscription')}
    </Button>
  );
}

export const ProfilingUpgradePlanButton = withSubscription(UpgradePlanButton, {
  noLoader: true,
});

interface ProfilingAM1OrMMXUpgradeProps {
  fallback: React.ReactNode;
  organization: Organization;
  subscription: Subscription;
}

function ProfilingAM1OrMMXUpgradeComponent({
  organization,
  subscription,
  fallback,
}: ProfilingAM1OrMMXUpgradeProps) {
  if (hidePromptTiers.includes(subscription.planTier)) {
    return <Fragment>{fallback}</Fragment>;
  }

  const userCanUpgradePlan = organization.access?.includes('org:billing');
  return (
    <Fragment>
      <h3>{t('Function level insights')}</h3>
      <p>
        {userCanUpgradePlan
          ? t(
              'Discover slow-to-execute or resource intensive functions within your application. To access profiling, please update to the latest version of your plan.'
            )
          : t(
              'Discover slow-to-execute or resource intensive functions within your application. To access profiling, please request your account owner to update to the latest version of your plan.'
            )}
      </p>
    </Fragment>
  );
}

export const ProfilingAM1OrMMXUpgrade = withSubscription(
  ProfilingAM1OrMMXUpgradeComponent,
  {
    noLoader: true,
  }
);
