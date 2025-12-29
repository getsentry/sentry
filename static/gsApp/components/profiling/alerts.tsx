import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {Heading, Text} from 'sentry/components/core/text';
import {DATA_CATEGORY_INFO} from 'sentry/constants';
import {IconClose, IconInfo, IconWarning} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import getDaysSinceDate from 'sentry/utils/getDaysSinceDate';
import {getProfileDurationCategoryForPlatform} from 'sentry/utils/profiling/platforms';
import {useApiQuery} from 'sentry/utils/queryClient';
import useDismissAlert from 'sentry/utils/useDismissAlert';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

import {openAM2ProfilingUpsellModal} from 'getsentry/actionCreators/modal';
import AddEventsCTA, {type EventType} from 'getsentry/components/addEventsCTA';
import StartTrialButton from 'getsentry/components/startTrialButton';
import UpgradeOrTrialButton from 'getsentry/components/upgradeOrTrialButton';
import withSubscription from 'getsentry/components/withSubscription';
import useSubscription from 'getsentry/hooks/useSubscription';
import type {BilledDataCategoryInfo, ProductTrial, Subscription} from 'getsentry/types';
import {PlanTier} from 'getsentry/types';
import {
  displayBudgetName,
  getProductTrial,
  isAm2Plan,
  isAm3Plan,
  isEnterprise,
  UsageAction,
} from 'getsentry/utils/billing';
import {getCategoryInfoFromPlural} from 'getsentry/utils/dataCategory';
import {BudgetUsage, checkBudgetUsageFor} from 'getsentry/utils/profiling';
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
  type?: 'danger';
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
      system
      trailingItems={trailingItems}
      type={type ? type : dismiss ? 'info' : 'danger'}
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
        ? tct(
            '[bold:Profiling Beta Ending Soon:] Your free access ends May 19, 2025. Profiling will require a [budgetTerm] after this date. To avoid disruptions, upgrade to a paid plan.',
            {
              bold: <b />,
              budgetTerm: displayBudgetName(subscription.planDetails, {withBudget: true}),
            }
          )
        : isEnterprise(subscription.plan)
          ? tct(
              '[bold:Profiling Beta Ending Soon:] Your free access ends May 19, 2025. To avoid disruptions, contact your account manager before then to add it to your plan.',
              {bold: <b />}
            )
          : tct(
              '[bold:Profiling Beta Ending Soon:] Your free access ends May 19, 2025. Profiling will require a [budgetTerm] after this date.',
              {
                bold: <b />,
                budgetTerm: displayBudgetName(subscription.planDetails, {
                  withBudget: true,
                }),
              }
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

interface ContinuousProfilingBillingRequirementBanner {
  project: Project;
}

export function ContinuousProfilingBillingRequirementBanner({
  project,
}: ContinuousProfilingBillingRequirementBanner) {
  const organization = useOrganization();
  const subscription = useSubscription();

  if (!subscription) {
    return null;
  }

  // only check quota for AM2/AM3 plans
  if (!isAm2Plan(subscription.plan) && !isAm3Plan(subscription.plan)) {
    return null;
  }

  const dataCategory = getProfileDurationCategoryForPlatform(project.platform);

  // We don't know the correct category for the platform,
  // likely doesn't support profiling.
  if (!dataCategory) {
    return null;
  }

  const categoryInfo = getCategoryInfoFromPlural(dataCategory);
  if (!categoryInfo) {
    return null;
  }

  // There's budget allocated so profiling can be used.
  const budgetUsage = checkBudgetUsageFor(subscription, dataCategory);

  if (budgetUsage === BudgetUsage.EXCEEDED) {
    // budget configured but has been consumed
    return null;
  }

  // only true when there is no configured budget
  if (budgetUsage !== BudgetUsage.UNAVAILABLE) {
    return null;
  }

  if (subscription.canTrial) {
    return (
      <BusinessTrialBanner
        dataCategory={dataCategory}
        categoryInfo={categoryInfo}
        subscription={subscription}
        organization={organization}
      />
    );
  }

  const trial = getProductTrial(subscription.productTrials ?? null, dataCategory);

  if (trial) {
    const daysLeft = -1 * getDaysSinceDate(trial.endDate ?? '');
    if (daysLeft >= 0) {
      if (trial.isStarted) {
        return null;
      }
      return (
        <ProductTrialBanner
          trial={trial}
          dataCategory={dataCategory}
          categoryInfo={categoryInfo}
          subscription={subscription}
          organization={organization}
        />
      );
    }
  }

  return (
    <OnDemandOrPaygBanner
      dataCategory={dataCategory}
      categoryInfo={categoryInfo}
      subscription={subscription}
      organization={organization}
    />
  );
}

interface ProductBannerProps {
  categoryInfo: BilledDataCategoryInfo;
  dataCategory: DataCategory.PROFILE_DURATION | DataCategory.PROFILE_DURATION_UI;
  organization: Organization;
  subscription: Subscription;
}

function BusinessTrialBanner({
  organization,
  categoryInfo,
  subscription,
}: ProductBannerProps) {
  return (
    <Alert type="info">
      <Heading as="h3">{t('Try Sentry Business for Free')}</Heading>
      <AlertBody>
        <Text>
          {tct(
            'Want to give [product] a test drive without paying? Start a Business plan trial, free for 14 days.',
            {product: categoryInfo.productName}
          )}
        </Text>
      </AlertBody>
      <div>
        <UpgradeOrTrialButton
          source="profiling_onboarding"
          action="trial"
          subscription={subscription}
          organization={organization}
        />
      </div>
    </Alert>
  );
}

interface ProductTrialBannerProps extends ProductBannerProps {
  trial: ProductTrial;
}

function ProductTrialBanner({
  organization,
  categoryInfo,
  trial,
}: ProductTrialBannerProps) {
  const [isStartingTrial, setIsStartingTrial] = useState(false);

  return (
    <Alert type="info">
      <Heading as="h3">
        {tct('Try [product] for free', {product: categoryInfo.productName})}
      </Heading>
      <AlertBody>
        <Text>
          {tct(
            'Activate your trial to take advantage of 14 days of unlimited [product]',
            {
              product: categoryInfo.productName,
            }
          )}
        </Text>
      </AlertBody>
      <div>
        <StartTrialButton
          size="sm"
          organization={organization}
          source="profiling_onboarding"
          requestData={{
            productTrial: {
              category: trial.category,
              reasonCode: trial.reasonCode,
            },
          }}
          aria-label={t('Start trial')}
          priority="primary"
          handleClick={() => setIsStartingTrial(true)}
          onTrialStarted={() => setIsStartingTrial(true)}
          onTrialFailed={() => setIsStartingTrial(false)}
          busy={isStartingTrial}
          disabled={isStartingTrial}
        />
      </div>
    </Alert>
  );
}

function OnDemandOrPaygBanner({
  dataCategory,
  organization,
  categoryInfo,
  subscription,
}: ProductBannerProps) {
  const eventTypes: EventType[] = [
    getCategoryInfoFromPlural(dataCategory)?.name as EventType,
  ];
  const hasBillingPerms = organization.access?.includes('org:billing');

  return (
    <Alert type="info">
      <Heading as="h3">
        {displayBudgetName(subscription.planDetails, {title: true})}
      </Heading>
      <AlertBody>
        <Text>
          {tct(
            '[product] is charged on a [budgetTerm] basis. Please ensure you have set up a budget.',
            {
              product: categoryInfo.productName,
              budgetTerm: subscription.planDetails.budgetTerm,
            }
          )}
        </Text>
      </AlertBody>
      <div>
        <AddEventsCTA
          organization={organization}
          subscription={subscription}
          buttonProps={{
            priority: 'primary',
            size: 'sm',
            style: {textDecoration: 'none'},
          }}
          eventTypes={eventTypes}
          action={
            hasBillingPerms ? UsageAction.ADD_EVENTS : UsageAction.REQUEST_ADD_EVENTS
          }
          referrer="profiling-onboarding"
          source="profiling_onboarding"
        />
      </div>
    </Alert>
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
  border-radius: ${p => p.theme.radius.md};
  width: ${space(0.5)};
  height: ${space(0.5)};
  background-color: ${p => p.theme.tokens.content.primary};
`;

const AlertBody = styled('div')`
  margin-bottom: ${space(1)};
`;
