import {Fragment} from 'react';

import {Alert} from 'sentry/components/core/alert';
import {BodyTitle} from 'sentry/components/updatedEmptyState';
import {DATA_CATEGORY_INFO} from 'sentry/constants';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DataCategory} from 'sentry/types/core';
import type {Project} from 'sentry/types/project';
import {getProfileDurationCategoryForPlatform} from 'sentry/utils/profiling/platforms';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

import AddEventsCTA, {type EventType} from 'getsentry/components/addEventsCTA';
import ProductTrialAlert from 'getsentry/components/productTrial/productTrialAlert';
import useSubscription from 'getsentry/hooks/useSubscription';
import {
  getProductTrial,
  isAm2Plan,
  isAm3Plan,
  UsageAction,
} from 'getsentry/utils/billing';
import {getCategoryInfoFromPlural} from 'getsentry/utils/dataCategory';
import {hasBudgetFor} from 'getsentry/utils/profiling';

interface ContinuousProfilingProductTrialBannerProps {
  project: Project;
}

export function ContinuousProfilingProductTrialBanner({
  project,
}: ContinuousProfilingProductTrialBannerProps) {
  const api = useApi();
  const organization = useOrganization();
  const subscription = useSubscription();

  if (!subscription) {
    return null;
  }

  const dataCategory = getProfileDurationCategoryForPlatform(project.platform);

  // Profiling not supported for this platform
  if (!dataCategory) {
    return null;
  }

  if (hasBudgetFor(subscription, dataCategory)) {
    return null;
  }

  // Business trial available
  if (subscription.canTrial) {
    // TODO:: should the business trial be prompted here instead of embedding it?
    return null;
  }

  const trial = getProductTrial(subscription.productTrials ?? null, dataCategory);

  // Product trial available
  if (trial) {
    return (
      <Alert.Container>
        <ProductTrialAlert
          trial={trial}
          subscription={subscription}
          organization={organization}
          product={dataCategory}
          api={api}
          dismissable={false}
          showIcon={false}
          system={false}
        />
      </Alert.Container>
    );
  }

  if (isAm2Plan(subscription.plan) || isAm3Plan(subscription.plan)) {
    const eventTypes: EventType[] = [
      dataCategory === DataCategory.PROFILE_DURATION
        ? (DATA_CATEGORY_INFO.profile_duration.singular as EventType)
        : (DATA_CATEGORY_INFO.profile_duration_ui.singular as EventType),
    ];

    const productName = getProductName(dataCategory);

    return (
      <Alert.Container>
        <Alert
          type="muted"
          showIcon={false}
          trailingItems={
            <AddEventsCTA
              action={UsageAction.ADD_EVENTS}
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
              source="continuous-profiling-product-trial-banner"
            />
          }
        >
          {isAm2Plan(subscription.plan) ? (
            <Fragment>
              <BodyTitle>{t('On-demand required')}</BodyTitle>
              <div>
                {tct(
                  '[productName] requires a on-demand budget. Please ensure you have setup a budget',
                  {productName}
                )}
              </div>
            </Fragment>
          ) : (
            <Fragment>
              <BodyTitle>{t('Pay-as-you-go required')}</BodyTitle>
              <div>
                {tct(
                  '[productName] requires a pay-as-you-go budget. Please ensure you have setup a budget.',
                  {
                    productName,
                  }
                )}
              </div>
            </Fragment>
          )}
        </Alert>
      </Alert.Container>
    );
  }

  return null;
}

function getProductName(category: DataCategory) {
  const categoryInfo = getCategoryInfoFromPlural(category);
  return categoryInfo?.productName ?? category;
}
