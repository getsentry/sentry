import React, {useState} from 'react';
import styled from '@emotion/styled';

import type {Client} from 'sentry/api';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {IconClose} from 'sentry/icons/iconClose';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {browserHistory} from 'sentry/utils/browserHistory';
import getDaysSinceDate from 'sentry/utils/getDaysSinceDate';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';

import {sendUpgradeRequest} from 'getsentry/actionCreators/upsell';
import ProductTrialTag from 'getsentry/components/productTrial/productTrialTag';
import StartTrialButton from 'getsentry/components/startTrialButton';
import type {ProductTrial, Subscription} from 'getsentry/types';
import {getCategoryInfoFromPlural} from 'getsentry/utils/dataCategory';
import titleCase from 'getsentry/utils/titleCase';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';

function getProductName(category: DataCategory) {
  const categoryInfo = getCategoryInfoFromPlural(category);
  return categoryInfo?.productName ?? category;
}

function getProductDocsUrl(category: DataCategory) {
  const categoryInfo = getCategoryInfoFromPlural(category);
  return categoryInfo?.docsUrl ?? '';
}

interface ProductTrialAlertProps {
  api: Client;
  organization: Organization;
  subscription: Subscription;
  trial: ProductTrial;
  onDismiss?: () => void;
  product?: DataCategory;
}

function ProductTrialAlert(props: ProductTrialAlertProps) {
  const {trial, subscription, organization, onDismiss, product, api} = props;
  const [isStartingTrial, setIsStartingTrial] = useState(false);
  const [isUpgradeSent, setIsUpgradeSent] = useState(false);

  const daysLeft = -1 * getDaysSinceDate(trial.endDate ?? '');

  if (daysLeft < -7) {
    return null;
  }

  const isPaid = subscription.planDetails?.price > 0;
  const hasBillingRole = organization.access?.includes('org:billing');

  let alertText: string | null = null;
  let alertHeader: string | null = null;
  let alertButton: React.ReactElement | null = null;

  if (daysLeft >= 0 && !trial.isStarted) {
    alertHeader = t('Try %s for free', getProductName(trial.category));
    alertText = t(
      'Activate your trial to take advantage of %d days of unlimited %s',
      trial.lengthDays ?? 14,
      getProductName(product ?? trial.category)
    );

    alertButton = (
      <StartTrialButton
        size="sm"
        organization={organization}
        source="alert-product-trials"
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
    );
  } else if (daysLeft > 7 && trial.isStarted) {
    alertHeader = t('%s Trial', titleCase(getProductName(trial.category)));
    alertText = t(
      'You have full access to unlimited %s until %s',
      getProductName(product ? product : trial.category),
      trial.endDate
    );

    alertButton = (
      <LinkButton size="sm" external href={getProductDocsUrl(product ?? trial.category)}>
        {t('Learn More')}
      </LinkButton>
    );
  } else if (daysLeft > 0 && daysLeft <= 7 && trial.isStarted) {
    alertHeader = t('%s Trial', titleCase(getProductName(trial.category)));
    alertText = t(
      'Keep using more %s by upgrading your plan by %s',
      getProductName(product ?? trial.category),
      trial.endDate
    );

    alertButton =
      isPaid && !hasBillingRole ? (
        <Button
          size="sm"
          disabled={isUpgradeSent}
          onClick={() => {
            sendUpgradeRequest({
              api,
              organization,
              handleSuccess: () => setIsUpgradeSent(true),
            });
          }}
        >
          {t('Request Upgrade')}
        </Button>
      ) : (
        <Button
          priority="primary"
          onClick={() => {
            browserHistory.push(
              normalizeUrl(`/settings/${organization.slug}/billing/checkout/`)
            );
          }}
        >
          {t('Update Plan')}
        </Button>
      );
  } else if (daysLeft < 0 && daysLeft >= -7 && trial.isStarted) {
    alertHeader = t('%s Trial', titleCase(getProductName(trial.category)));
    alertText = t(
      'Your unlimited %s trial ended. Keep using more by upgrading your plan.',
      getProductName(product ?? trial.category)
    );

    alertButton =
      isPaid && !hasBillingRole ? (
        <Button
          size="sm"
          disabled={isUpgradeSent}
          onClick={() => {
            sendUpgradeRequest({
              api,
              organization,
              handleSuccess: () => setIsUpgradeSent(true),
            });
          }}
        >
          {t('Request Upgrade')}
        </Button>
      ) : (
        <Button
          priority="primary"
          onClick={() => {
            browserHistory.push(
              normalizeUrl(`/settings/${organization.slug}/billing/checkout/`)
            );
          }}
        >
          {t('Update Plan')}
        </Button>
      );
  }

  const actions = alertButton && (
    <ButtonBar gap="lg">
      {alertButton}
      <Button
        icon={<IconClose size="sm" />}
        data-test-id="btn-overage-notification-snooze"
        onClick={() => {
          trackGetsentryAnalytics('product_trial.clicked_snooze', {
            organization,
            subscription,
            event_types: trial.category,
            is_warning: false,
          });
          onDismiss?.();
        }}
        size="zero"
        borderless
        title={t('Dismiss this period')}
        aria-label={t('Dismiss this period')}
      />
    </ButtonBar>
  );

  return (
    <TrialAlert system type="muted" trailingItems={actions}>
      <React.Fragment>
        {alertHeader && (
          <Heading>
            <h4>{alertHeader}</h4>
            <ProductTrialTag trial={trial} type="default" showTrialEnded />
          </Heading>
        )}
        {alertText && <div>{alertText}</div>}
      </React.Fragment>
    </TrialAlert>
  );
}

export default ProductTrialAlert;

const TrialAlert = styled(Alert)`
  align-items: center;
  background: ${p => p.theme.backgroundElevated};
`;

const Heading = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};

  h4 {
    margin: 0;
  }
`;
