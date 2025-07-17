import {Fragment, useCallback, useEffect, useMemo} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {DATA_CATEGORY_INFO} from 'sentry/constants';
import {IconClose, IconInfo, IconWarning} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {useApiQuery} from 'sentry/utils/queryClient';
import useDismissAlert from 'sentry/utils/useDismissAlert';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

import {openAM2ProfilingUpsellModal} from 'getsentry/actionCreators/modal';
import AddEventsCTA, {type EventType} from 'getsentry/components/addEventsCTA';
import withSubscription from 'getsentry/components/withSubscription';
import type {Subscription} from 'getsentry/types';
import {PlanTier} from 'getsentry/types';
import {isAm2Plan, isEnterprise} from 'getsentry/utils/billing';
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
  };
  children: React.ReactNode;
  dismiss: undefined | (() => void);
  disableAction?: boolean;
  type?: 'error';
}

function GraceAlert({children, action, dismiss, type, disableAction}: GraceAlertProps) {
  const trailingItems = (
    <Fragment>
      <Button size="xs" onClick={action.onClick} disabled={disableAction}>
        {action.label}
      </Button>
      {dismiss ? (
        <StyledButton priority="link" size="sm" onClick={dismiss}>
          <IconClose color="gray500" size="sm" />
        </StyledButton>
      ) : null}
    </Fragment>
  );

  return (
    <Alert
      icon={type ? <IconWarning /> : dismiss ? <IconInfo /> : <IconWarning />}
      showIcon
      system
      trailingItems={trailingItems}
      type={type ? type : dismiss ? 'info' : 'error'}
    >
      {children}
    </Alert>
  );
}

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

interface ContinuousProfilingBetaAlertBannerInner {
  organization: Organization;
  subscription: Subscription;
}

function ContinuousProfilingBetaAlertBannerInner({
  organization,
  subscription,
}: ContinuousProfilingBetaAlertBannerInner) {
  if (!organization.features.includes('continuous-profiling-beta')) {
    return null;
  }

  const eventTypes: EventType[] = [
    DATA_CATEGORY_INFO.profile_duration.singular as EventType,
    DATA_CATEGORY_INFO.profile_duration_ui.singular as EventType,
  ];

  return (
    <Alert
      type="warning"
      system
      showIcon
      trailingItems={
        <AddEventsCTA
          organization={organization}
          subscription={subscription}
          buttonProps={{
            priority: 'default',
            size: 'xs',
            style: {marginBlock: `-${space(0.25)}`},
          }}
          eventTypes={eventTypes}
          notificationType="overage_critical"
          referrer={`overage-alert-${eventTypes.join('-')}`}
          source="continuous-profiling-beta-trial-banner"
        />
      }
    >
      {subscription.isFree
        ? isAm2Plan(subscription.plan)
          ? tct(
              '[bold:Profiling Beta Ending Soon:] Your free access ends May 19, 2025. Profiling will require a on-demand budget after this date. To avoid disruptions, upgrade to a paid plan.',
              {bold: <b />}
            )
          : tct(
              '[bold:Profiling Beta Ending Soon:] Your free access ends May 19, 2025. Profiling will require a pay-as-you-go budget after this date. To avoid disruptions, upgrade to a paid plan.',
              {bold: <b />}
            )
        : isEnterprise(subscription.plan)
          ? tct(
              '[bold:Profiling Beta Ending Soon:] Your free access ends May 19, 2025. To avoid disruptions, contact your account manager before then to add it to your plan.',
              {bold: <b />}
            )
          : isAm2Plan(subscription.plan)
            ? tct(
                '[bold:Profiling Beta Ending Soon:] Your free access ends May 19, 2025. Profiling will require an on-demand budget after this date.',
                {bold: <b />}
              )
            : tct(
                '[bold:Profiling Beta Ending Soon:] Your free access ends May 19, 2025. Profiling will require a pay-as-you-go budget after this date.',
                {bold: <b />}
              )}
    </Alert>
  );
}

export const ContinuousProfilingBetaAlertBanner = withSubscription(
  ContinuousProfilingBetaAlertBannerInner
);

export function ContinuousProfilingBetaSDKAlertBanner() {
  const sdkDeprecationResults = useSDKDeprecations();

  const sdkDeprecations = useMemo(() => {
    const sdks: Map<string, SDKDeprecation> = new Map();

    for (const sdk of sdkDeprecationResults.data?.data ?? []) {
      const key = `${sdk.sdkName}:${sdk.sdkVersion}`;
      sdks.set(key, sdk);
    }

    return sdks;
  }, [sdkDeprecationResults.data?.data]);

  if (sdkDeprecations.size <= 0) {
    return null;
  }

  return (
    <Alert.Container>
      <Alert system type="warning">
        {tct(
          '[bold:Action Needed: Profiling beta period ends May 19, 2025.] Your SDK is out of date. To continue using profiling without interruption, upgrade to the latest version:',
          {
            bold: <b />,
          }
        )}
        <SDKDeprecationsContainer>
          {sdkDeprecations.values().map(sdk => {
            const key = `${sdk.projectId}-${sdk.sdkName}-${sdk.sdkVersion}`;
            return (
              <SDKDeprecationContainer key={key}>
                <Dot />
                {tct('[name] minimum version [version]', {
                  name: <code>{sdk.sdkName}</code>,
                  version: <code>{sdk.minimumVersion}</code>,
                })}
              </SDKDeprecationContainer>
            );
          })}
        </SDKDeprecationsContainer>
      </Alert>
    </Alert.Container>
  );
}

interface SDKDeprecation {
  minimumVersion: string;
  projectId: string;
  sdkName: string;
  sdkVersion: string;
}

function useSDKDeprecations() {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const path = `/organizations/${organization.slug}/sdk-deprecations/`;
  const options = {
    query: {
      project: selection.projects,
      event_type: 'profile',
    },
  };

  return useApiQuery<{data: SDKDeprecation[]}>([path, options], {
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: false,
  });
}

const SDKDeprecationsContainer = styled('ul')`
  margin: 0;
`;

const SDKDeprecationContainer = styled('li')`
  display: flex;
  flex-direction: row;
  align-items: baseline;
`;

const Dot = styled('span')`
  display: inline-block;
  margin-right: ${space(1)};
  border-radius: ${p => p.theme.borderRadius};
  width: ${space(0.5)};
  height: ${space(0.5)};
  background-color: ${p => p.theme.textColor};
`;
