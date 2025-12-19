import {useEffect, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {AlertLink} from 'sentry/components/core/alert/alertLink';
import {Button} from 'sentry/components/core/button';
import {Container, Flex} from 'sentry/components/core/layout';
import {Select} from 'sentry/components/core/select';
import {Text} from 'sentry/components/core/text';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import PanelBody from 'sentry/components/panels/panelBody';
import Redirect from 'sentry/components/redirect';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconCheckmark, IconInfo} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import {useApiQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useMedia from 'sentry/utils/useMedia';
import useOrganization from 'sentry/utils/useOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

import withSubscription from 'getsentry/components/withSubscription';
import type {Subscription} from 'getsentry/types';
import {displayBudgetName} from 'getsentry/utils/billing';
import ContactBillingMembers from 'getsentry/views/contactBillingMembers';
import SubscriptionPageContainer from 'getsentry/views/subscriptionPage/components/subscriptionPageContainer';
import {hasSpendVisibilityNotificationsFeature} from 'getsentry/views/subscriptionPage/utils';

interface SubscriptionNotificationsProps extends RouteComponentProps<unknown, unknown> {
  subscription: Subscription;
}

type ThresholdsType = {
  perProductOndemandPercent: number[];
  reservedPercent: number[];
};

const OPTIONS = [
  {label: '90%', value: 90},
  {label: '80%', value: 80},
  {label: '70%', value: 70},
  {label: '60%', value: 60},
  {label: '50%', value: 50},
  {label: '40%', value: 40},
  {label: '30%', value: 30},
  {label: '20%', value: 20},
  {label: '10%', value: 10},
];

function isThresholdsEqual(value: ThresholdsType, other: ThresholdsType): boolean {
  return isEqual(value, other);
}

function SubscriptionNotifications({subscription}: SubscriptionNotificationsProps) {
  const organization = useOrganization();
  const api = useApi();
  const theme = useTheme();
  const isSmallScreen = useMedia(`(max-width: ${theme.breakpoints.sm})`);

  const {
    data: backendThresholds,
    isPending,
    refetch,
    isError,
  } = useApiQuery<ThresholdsType>(
    [`/customers/${organization.slug}/spend-notifications/`],
    {
      staleTime: 0,
      gcTime: 0,
    }
  );

  const [notificationThresholds, setNotificationThresholds] = useState<
    ThresholdsType | undefined
  >(undefined);

  useEffect(() => {
    if (!isPending && backendThresholds && !notificationThresholds) {
      setNotificationThresholds(backendThresholds);
    }
  }, [backendThresholds, isPending, notificationThresholds]);

  const onSubmit = () => {
    addLoadingMessage(t('Saving threshold notifications\u2026'));
    api
      .requestPromise(`/customers/${organization.slug}/spend-notifications/`, {
        method: 'POST',
        data: notificationThresholds,
      })
      .then(response => {
        addSuccessMessage(t('Threshold notifications saved successfully.'));
        setNotificationThresholds(response);
        refetch();
      })
      .catch(() => {
        addErrorMessage(t('Unable to save threshold notifications.'));
      });
  };

  const hasBillingPerms = organization.access?.includes('org:billing');

  if (!hasSpendVisibilityNotificationsFeature(organization)) {
    return <Redirect to={`/settings/${organization.slug}/billing/overview/`} />;
  }

  return (
    <SubscriptionPageContainer background="primary" organization={organization}>
      <SentryDocumentTitle
        title={t('Manage Spend Notifications')}
        orgSlug={organization.slug}
      />
      <SettingsPageHeader
        title={t('Manage Spend Notifications')}
        subtitle={t(
          "Receive notifications when your organization's usage exceeds a threshold"
        )}
        action={
          !isSmallScreen && (
            <NotificationButtons
              onDemandEnabled={subscription.planDetails.allowOnDemand}
              backendThresholds={backendThresholds}
              notificationThresholds={notificationThresholds}
              setNotificationThresholds={setNotificationThresholds}
              onSubmit={onSubmit}
            />
          )
        }
      />
      <Flex direction="column" gap="2xl">
        {isSmallScreen && (
          <NotificationButtons
            onDemandEnabled={subscription.planDetails.allowOnDemand}
            backendThresholds={backendThresholds}
            notificationThresholds={notificationThresholds}
            setNotificationThresholds={setNotificationThresholds}
            onSubmit={onSubmit}
          />
        )}
        <AlertLink
          to="/settings/account/notifications/quota/"
          type="info"
          trailingItems={<IconInfo />}
        >
          {t(
            'To adjust your personal billing notification settings, please go to Fine Tune Alerts in your account settings.'
          )}
        </AlertLink>
        {hasBillingPerms ? (
          isPending || !notificationThresholds || !backendThresholds ? (
            <LoadingIndicator />
          ) : isError ? (
            <LoadingError onRetry={refetch} />
          ) : (
            <Container border="primary" radius="md" padding="md 0 md md">
              <ThresholdInputs
                notificationThresholds={notificationThresholds}
                setNotificationThresholds={setNotificationThresholds}
                subscription={subscription}
              />
            </Container>
          )
        ) : (
          <ContactBillingMembers />
        )}
      </Flex>
    </SubscriptionPageContainer>
  );
}

type GenericConsumptionGroupProps = {
  help: string;
  isNewBillingUI: boolean;
  label: string;
  thresholds: number[];
  updateThresholds: (newThresholds: number[]) => void;
};

function GenericConsumptionGroup(props: GenericConsumptionGroupProps) {
  const {thresholds, updateThresholds, label, help, isNewBillingUI} = props;

  const [newThresholdValue, setNewThresholdValue] = useState<number | undefined>(
    undefined
  );

  const availableThresholdValues = OPTIONS.map(option => option.value);

  useEffect(() => {
    if (
      newThresholdValue !== undefined &&
      !availableThresholdValues.includes(newThresholdValue)
    ) {
      setNewThresholdValue(undefined);
    }
  }, [newThresholdValue, availableThresholdValues]);

  return (
    <ConsumptionGroup
      label={isNewBillingUI ? <Text bold>{label}</Text> : label}
      help={help}
    >
      <Select
        aria-label={t('Update %s spend notification thresholds', label.toLowerCase())}
        clearable
        multiple
        value={thresholds}
        options={availableThresholdValues.map(value => ({label: `${value}%`, value}))}
        onChange={(option: Array<{label: string; value: number}>) => {
          updateThresholds(option.map(o => o.value));
        }}
      />
    </ConsumptionGroup>
  );
}

function ThresholdInputs({
  notificationThresholds,
  setNotificationThresholds,
  subscription,
  isNewBillingUI,
}: {
  isNewBillingUI: boolean;
  notificationThresholds: ThresholdsType;
  setNotificationThresholds: (newThresholds: ThresholdsType) => void;
  subscription: Subscription;
}) {
  const onDemandEnabled = subscription.planDetails.allowOnDemand;
  return (
    <PanelBody>
      <GenericConsumptionGroup
        isNewBillingUI={isNewBillingUI}
        label={t('Subscription consumption')}
        help={
          isNewBillingUI
            ? t('Applies to all reserved volumes in your subscription')
            : t(
                "Receive notifications when your organization's usage exceeds a threshold (% of monthly subscription)"
              )
        }
        thresholds={notificationThresholds.reservedPercent}
        updateThresholds={newThresholds => {
          setNotificationThresholds({
            ...notificationThresholds,
            reservedPercent: newThresholds,
          });
        }}
      />
      {onDemandEnabled && (
        <GenericConsumptionGroup
          isNewBillingUI={isNewBillingUI}
          label={t(
            '%s consumption',
            displayBudgetName(subscription.planDetails, {title: true})
          )}
          help={
            isNewBillingUI
              ? '% ' +
                t(
                  'of %s usage, up to your set limit',
                  displayBudgetName(subscription.planDetails)
                )
              : t(
                  "Receive notifications when your organization's usage exceeds a threshold (%% of monthly %s)",
                  displayBudgetName(subscription.planDetails, {
                    title: true,
                    withBudget: true,
                  })
                )
          }
          thresholds={notificationThresholds.perProductOndemandPercent}
          updateThresholds={newThresholds => {
            setNotificationThresholds({
              ...notificationThresholds,
              perProductOndemandPercent: newThresholds,
            });
          }}
        />
      )}
    </PanelBody>
  );
}

function NotificationButtons({
  backendThresholds,
  notificationThresholds,
  setNotificationThresholds,
  onSubmit,
  onDemandEnabled,
  isNewBillingUI,
}: {
  isNewBillingUI: boolean;
  onDemandEnabled: boolean;
  onSubmit: () => void;
  setNotificationThresholds: (newThresholds: ThresholdsType) => void;
  backendThresholds?: ThresholdsType;
  notificationThresholds?: ThresholdsType;
}) {
  return (
    <Flex gap="md">
      <Button
        disabled={
          !notificationThresholds ||
          !backendThresholds ||
          isThresholdsEqual(backendThresholds, notificationThresholds)
        }
        onClick={() => {
          if (!backendThresholds) {
            return;
          }
          setNotificationThresholds(backendThresholds);
        }}
        analyticsParams={{isNewBillingUI}}
      >
        {t('Reset')}
      </Button>
      <Button
        icon={<IconCheckmark />}
        priority="primary"
        disabled={
          !notificationThresholds ||
          !backendThresholds ||
          isThresholdsEqual(backendThresholds, notificationThresholds) ||
          notificationThresholds.reservedPercent.length === 0 ||
          (onDemandEnabled &&
            notificationThresholds.perProductOndemandPercent.length === 0)
        }
        onClick={onSubmit}
        analyticsParams={{isNewBillingUI}}
      >
        {t('Save changes')}
      </Button>
    </Flex>
  );
}

export default withSubscription(SubscriptionNotifications);

const ConsumptionGroup = styled(FieldGroup)`
  align-items: flex-start;
`;
