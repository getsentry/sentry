import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import AlertLink from 'sentry/components/alertLink';
import {Button} from 'sentry/components/button';
import {CompactSelect} from 'sentry/components/compactSelect';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelFooter from 'sentry/components/panels/panelFooter';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {IconAdd, IconDelete, IconInfo} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import {useApiQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import withOrganization from 'sentry/utils/withOrganization';

import withSubscription from 'getsentry/components/withSubscription';
import {PlanTier, type Subscription} from 'getsentry/types';
import ContactBillingMembers from 'getsentry/views/contactBillingMembers';

import SubscriptionHeader from './subscriptionHeader';
import {trackSubscriptionView} from './utils';

interface SubscriptionNotificationsProps extends RouteComponentProps<{}, {}> {
  organization: Organization;
  subscription: Subscription;
}

type ThresholdsType = {
  perProductOndemandPercent: Array<number>;
  reservedPercent: Array<number>;
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

const MAX_THRESHOLDS = OPTIONS.length;

function isThresholdsEqual(value: ThresholdsType, other: ThresholdsType): boolean {
  return isEqual(value, other);
}

function SubscriptionNotifications({
  organization,
  subscription,
}: SubscriptionNotificationsProps) {
  const api = useApi();
  useEffect(() => {
    trackSubscriptionView(organization, subscription, 'notifications');
  }, [organization, subscription]);

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

  const hasBillingPerms = organization.access?.includes('org:billing');
  if (!hasBillingPerms) {
    return <ContactBillingMembers />;
  }

  if (isPending || !backendThresholds || !notificationThresholds) {
    return (
      <Fragment>
        <SubscriptionHeader subscription={subscription} organization={organization} />
        <LoadingIndicator />
      </Fragment>
    );
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  const onDemandEnabled = subscription.planDetails.allowOnDemand;

  return (
    <Fragment>
      <SubscriptionHeader organization={organization} subscription={subscription} />
      <PageDescription>
        {t("Configure the thresholds for your organization's spend notifications.")}
      </PageDescription>
      <Panel>
        <PanelHeader>{t('Notification thresholds')}</PanelHeader>
        <PanelBody>
          <GenericConsumptionGroup
            label={t('Subscription Consumption')}
            help={t(
              "Receive notifications when your organization's usage exceeds a threshold (% of monthly subscription)"
            )}
            thresholds={notificationThresholds.reservedPercent}
            removeThreshold={indexToRemove => {
              setNotificationThresholds({
                ...notificationThresholds,
                reservedPercent: notificationThresholds.reservedPercent.filter(
                  (_, index) => index !== indexToRemove
                ),
              });
            }}
            updateThreshold={(indexToUpdate, value) => {
              setNotificationThresholds({
                ...notificationThresholds,
                reservedPercent: notificationThresholds.reservedPercent.map(
                  (threshold, index) => (index === indexToUpdate ? value : threshold)
                ),
              });
            }}
            addThreshold={value => {
              setNotificationThresholds({
                ...notificationThresholds,
                reservedPercent: [...notificationThresholds.reservedPercent, value],
              });
            }}
          />
          {onDemandEnabled && (
            <GenericConsumptionGroup
              label={
                subscription.planTier === PlanTier.AM3
                  ? t('Pay-as-you-go Consumption')
                  : t('On-Demand Consumption')
              }
              help={t(
                "Receive notifications when your organization's usage exceeds a threshold (%% of monthly %s budget)",
                subscription.planTier === PlanTier.AM3
                  ? t('Pay-as-you-go')
                  : t('On-Demand')
              )}
              thresholds={notificationThresholds.perProductOndemandPercent}
              removeThreshold={indexToRemove => {
                setNotificationThresholds({
                  ...notificationThresholds,
                  perProductOndemandPercent:
                    notificationThresholds.perProductOndemandPercent.filter(
                      (_, index) => index !== indexToRemove
                    ),
                });
              }}
              updateThreshold={(indexToUpdate, value) => {
                setNotificationThresholds({
                  ...notificationThresholds,
                  perProductOndemandPercent:
                    notificationThresholds.perProductOndemandPercent.map(
                      (threshold, index) => (index === indexToUpdate ? value : threshold)
                    ),
                });
              }}
              addThreshold={value => {
                setNotificationThresholds({
                  ...notificationThresholds,
                  perProductOndemandPercent: [
                    ...notificationThresholds.perProductOndemandPercent,
                    value,
                  ],
                });
              }}
            />
          )}
        </PanelBody>
        <NotificationsFooter>
          <Button
            disabled={isThresholdsEqual(backendThresholds, notificationThresholds)}
            onClick={() => {
              setNotificationThresholds(backendThresholds);
            }}
          >
            {t('Reset')}
          </Button>
          <Button
            priority="primary"
            disabled={isThresholdsEqual(backendThresholds, notificationThresholds)}
            onClick={() => {
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
            }}
          >
            {t('Save Changes')}
          </Button>
        </NotificationsFooter>
      </Panel>
      <AlertLink
        to="/settings/account/notifications/quota/"
        priority="info"
        icon={<IconInfo />}
      >
        {t(
          'To adjust your personal billing notification settings, please go to Fine Tune Alerts in your account settings.'
        )}
      </AlertLink>
    </Fragment>
  );
}

type GenericConsumptionGroupProps = {
  addThreshold: (value: number) => void;
  help: string;
  label: string;
  removeThreshold: (index: number) => void;
  thresholds: Array<number>;
  updateThreshold: (index: number, value: number) => void;
};

function GenericConsumptionGroup(props: GenericConsumptionGroupProps) {
  const {thresholds, removeThreshold, updateThreshold, addThreshold, label, help} = props;

  const [newThresholdValue, setNewThresholdValue] = useState<number | undefined>(
    undefined
  );

  const availableOptions = OPTIONS.filter(option => !thresholds.includes(option.value));
  const availableThresholdValues = availableOptions.map(option => option.value);

  const disableRemoveButton = thresholds.length <= 1;
  const hideAddButton = thresholds.length >= MAX_THRESHOLDS;

  useEffect(() => {
    if (
      newThresholdValue !== undefined &&
      !availableThresholdValues.includes(newThresholdValue)
    ) {
      setNewThresholdValue(undefined);
    }
  }, [newThresholdValue, availableThresholdValues]);

  return (
    <ConsumptionGroup label={label} help={help}>
      <SelectGroup>
        {thresholds.map((threshold, index) => {
          return (
            <SelectGroupRow key={index}>
              <StyledCompactSelect
                triggerLabel={`${threshold}%`}
                triggerProps={{style: {width: '100%', fontWeight: 'normal'}}}
                value={undefined}
                options={availableOptions}
                onChange={value => {
                  updateThreshold(index, value.value as number);
                }}
              />
              <Button
                priority="default"
                onClick={() => {
                  removeThreshold(index);
                }}
                icon={<IconDelete />}
                disabled={disableRemoveButton}
                aria-label={t('Remove notification threshold')}
              />
            </SelectGroupRow>
          );
        })}
        {hideAddButton ? null : (
          <SelectGroupRow>
            <StyledCompactSelect
              triggerLabel={
                newThresholdValue !== undefined
                  ? `${newThresholdValue}%`
                  : t('Add threshold')
              }
              triggerProps={{style: {width: '100%', fontWeight: 'normal'}}}
              value={undefined}
              options={availableOptions}
              onChange={value => {
                setNewThresholdValue(value.value as number);
              }}
            />
            <Button
              priority="primary"
              onClick={() => {
                if (newThresholdValue !== undefined) {
                  setNewThresholdValue(undefined);
                  addThreshold(newThresholdValue);
                }
              }}
              icon={<IconAdd />}
              disabled={newThresholdValue === undefined}
              aria-label={t('Add notification threshold')}
            />
          </SelectGroupRow>
        )}
      </SelectGroup>
    </ConsumptionGroup>
  );
}

export default withOrganization(withSubscription(SubscriptionNotifications));

const PageDescription = styled('p')`
  font-size: ${p => p.theme.fontSizeMedium};
  margin-bottom: ${space(2)};
`;

const NotificationsFooter = styled(PanelFooter)`
  padding: ${space(2)};
  display: flex;
  justify-content: flex-end;
  gap: ${space(1)};
  align-items: center;
`;

const ConsumptionGroup = styled(FieldGroup)`
  align-items: flex-start;
`;

const StyledCompactSelect = styled(CompactSelect)`
  width: 100%;
`;

const SelectGroup = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const SelectGroupRow = styled('div')`
  display: flex;
  gap: ${space(1)};
`;
