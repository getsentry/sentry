import React, {Fragment} from 'react';
import styled from '@emotion/styled';
import classNames from 'classnames';

import {addLoadingMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import {TabList, Tabs} from 'sentry/components/tabs';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';

import type {AdminConfirmRenderProps} from 'admin/components/adminConfirmationModal';
import PlanList, {type LimitName} from 'admin/components/planList';
import {ANNUAL, MONTHLY} from 'getsentry/constants';
import type {BillingConfig} from 'getsentry/types';
import {CheckoutType, PlanTier} from 'getsentry/types';
import {getAmPlanTier} from 'getsentry/utils/billing';

type Props = DeprecatedAsyncComponent['props'] &
  AdminConfirmRenderProps & {
    orgId: string;
    partnerPlanId: string | null;
  };

type State = DeprecatedAsyncComponent['state'] & {
  activeTier: Exclude<PlanTier, PlanTier.MM1>;
  am1BillingConfig: BillingConfig | null;
  am2BillingConfig: BillingConfig | null;
  am3BillingConfig: BillingConfig | null;
  billingInterval: 'monthly' | 'annual';
  contractInterval: 'monthly' | 'annual';
  mm2BillingConfig: BillingConfig | null;
  plan: null | string;
  reservedAttachments: null | number;
  reservedErrors: null | number;
  reservedMonitorSeats: null | number;
  reservedReplays: null | number;
  reservedSpans: null | number;
  reservedTransactions: null | number;
  reservedUptime: null | number;
};

/**
 * Rendered as part of a openAdminConfirmModal call
 */
class ChangePlanAction extends DeprecatedAsyncComponent<Props, State> {
  componentDidMount() {
    super.componentDidMount();
    this.props.setConfirmCallback(this.handleConfirm);
  }

  getDefaultState() {
    return {
      ...super.getDefaultState(),
      plan: this.props.partnerPlanId,
      reservedErrors: null,
      reservedTransactions: null,
      reservedReplays: null,
      reservedAttachments: null,
      reservedMonitorSeats: null,
      reservedUptime: null,
      reservedSpans: null,
      activeTier: this.props.partnerPlanId
        ? getAmPlanTier(this.props.partnerPlanId)
        : PlanTier.AM3,
      billingInterval: MONTHLY,
      contractInterval: MONTHLY,
      am1BillingConfig: null,
      mm2BillingConfig: null,
    };
  }

  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
    return [
      ['mm2BillingConfig', `/customers/${this.props.orgId}/billing-config/?tier=mm2`],
      ['am1BillingConfig', `/customers/${this.props.orgId}/billing-config/?tier=am1`],
      ['am2BillingConfig', `/customers/${this.props.orgId}/billing-config/?tier=am2`],
      ['am3BillingConfig', `/customers/${this.props.orgId}/billing-config/?tier=am3`],
    ];
  }

  hasProvisionPermission() {
    return ConfigStore.get('user')?.permissions?.has?.('billing.provision');
  }

  handleConfirm = async () => {
    const {onConfirm, orgId} = this.props;
    const {
      activeTier,
      plan,
      reservedErrors,
      reservedTransactions,
      reservedReplays,
      reservedAttachments,
      reservedMonitorSeats,
      reservedUptime,
      reservedSpans,
      reservedProfileDuration,
    } = this.state;
    const api = new Client();

    addLoadingMessage('Updating plan\u2026');

    if (activeTier === PlanTier.MM2) {
      const data = {plan};
      try {
        await api.requestPromise(`/customers/${orgId}/`, {
          method: 'PUT',
          data,
        });
        addSuccessMessage(
          `Customer account has been updated with ${JSON.stringify(data)}.`
        );
        onConfirm?.(data);
      } catch (error) {
        onConfirm?.({error});
      }
      return;
    }

    // AM plans use a different endpoint to update plans.
    const data: {
      plan: string | null;
      reservedAttachments: number | null;
      reservedErrors: number | null;
      reservedMonitorSeats: number | null;
      reservedReplays: number | null;
      reservedUptime: number | null;
      reservedProfileDuration?: number | null;
      reservedSpans?: number | null;
      reservedTransactions?: number | null;
    } = {
      plan,
      reservedErrors,
      reservedReplays,
      reservedAttachments,
      reservedMonitorSeats,
      reservedUptime,
      reservedProfileDuration,
    };
    if (reservedSpans) {
      data.reservedSpans = reservedSpans;
    }
    if (reservedTransactions) {
      data.reservedTransactions = reservedTransactions;
    }

    try {
      await api.requestPromise(`/customers/${orgId}/subscription/`, {
        method: 'PUT',
        data,
      });
      addSuccessMessage(
        `Customer account has been updated with ${JSON.stringify(data)}.`
      );
      onConfirm?.(data);
    } catch (error) {
      onConfirm?.({error});
    }
  };

  canSubmit() {
    const {
      activeTier,
      plan,
      reservedErrors,
      reservedTransactions,
      reservedAttachments,
      reservedReplays,
      reservedMonitorSeats,
      reservedUptime,
      reservedSpans,
      reservedProfileDuration,
      am2BillingConfig,
      am3BillingConfig,
    } = this.state;
    if (activeTier === PlanTier.MM2 && plan) {
      return true;
    }

    // TODO(brendan): remove checking profileDuration !== undefined once we launch profile duration
    const profileDurationTier =
      (activeTier === PlanTier.AM2 &&
        am2BillingConfig?.defaultReserved.profileDuration !== undefined) ||
      (activeTier === PlanTier.AM3 &&
        am3BillingConfig?.defaultReserved.profileDuration !== undefined);
    return (
      plan &&
      reservedErrors &&
      reservedReplays &&
      reservedAttachments &&
      reservedMonitorSeats &&
      reservedUptime &&
      (profileDurationTier ? reservedProfileDuration >= 0 : true) &&
      (reservedTransactions || reservedSpans)
    );
  }

  handlePlanChange = (planId: string) => {
    this.setState({plan: planId}, () => {
      this.props.disableConfirmButton(!this.canSubmit());
    });
  };

  handleLimitChange = (limit: LimitName, value: number) => {
    this.setState({[limit]: value}, () => {
      this.props.disableConfirmButton(!this.canSubmit());
    });
  };

  renderBody() {
    const {
      plan,
      reservedErrors,
      reservedAttachments,
      reservedReplays,
      reservedTransactions,
      reservedMonitorSeats,
      reservedUptime,
      reservedSpans,
      reservedProfileDuration,
      activeTier,
      loading,
      billingInterval,
      am1BillingConfig,
      am2BillingConfig,
      am3BillingConfig,
      mm2BillingConfig,
      contractInterval,
    } = this.state;

    const {partnerPlanId} = this.props;

    if (loading) {
      return null;
    }

    let planList: BillingConfig['planList'] = [];
    if (activeTier === PlanTier.MM2 && mm2BillingConfig) {
      planList = mm2BillingConfig.planList;
    } else if (activeTier === PlanTier.AM1 && am1BillingConfig) {
      planList = am1BillingConfig.planList;
    } else if (activeTier === PlanTier.AM2 && am2BillingConfig) {
      planList = am2BillingConfig.planList;
    } else if (activeTier === PlanTier.AM3 && am3BillingConfig) {
      planList = am3BillingConfig.planList;
    }

    if (activeTier === PlanTier.TEST) {
      // For TEST tier, combine all available plan lists and display only test plans
      planList = [
        ...(mm2BillingConfig?.planList || []),
        ...(am1BillingConfig?.planList || []),
        ...(am2BillingConfig?.planList || []),
        ...(am3BillingConfig?.planList || []),
      ].filter(p => p.isTestPlan && p.billingInterval === billingInterval);
    } else {
      planList = planList
        .sort((a, b) => a.reservedMinimum - b.reservedMinimum)
        .filter(
          p =>
            p.price &&
            p.contractInterval === contractInterval &&
            p.billingInterval === billingInterval &&
            (p.userSelectable || p.checkoutType === CheckoutType.BUNDLE) &&
            // Plan id on partner sponsored subscriptions is not modifiable so only including
            // the existing plan in the list
            (partnerPlanId === null || partnerPlanId === p.id)
        );
    }

    // Plan for partner sponsored subscriptions is not modifiable so skipping
    // the navigation that will allow modifying billing cycle and plan tier
    const PLAN_TABS = [
      {
        label: 'AM3',
        tier: PlanTier.AM3,
      },
      {
        label: 'AM2',
        tier: PlanTier.AM2,
      },
      {
        label: 'AM1',
        tier: PlanTier.AM1,
      },
      {
        label: 'MM2',
        tier: PlanTier.MM2,
      },
      {
        label: 'TEST',
        tier: PlanTier.TEST,
      },
    ];

    const header = partnerPlanId ? null : (
      <React.Fragment>
        <TabsContainer>
          <Tabs
            value={activeTier}
            onChange={tab => {
              this.setState({
                activeTier: tab,
                billingInterval: MONTHLY,
                contractInterval: MONTHLY,
                plan: null,
              });
            }}
          >
            <TabList>
              {PLAN_TABS.map(tab => (
                <TabList.Item key={tab.tier}>{tab.label}</TabList.Item>
              ))}
            </TabList>
          </Tabs>
        </TabsContainer>
        <ul className="nav nav-pills">
          <li
            className={classNames({
              active: contractInterval === MONTHLY && billingInterval === MONTHLY,
            })}
          >
            <a
              onClick={() =>
                this.setState({
                  billingInterval: MONTHLY,
                  contractInterval: MONTHLY,
                  plan: null,
                })
              }
            >
              Monthly
            </a>
          </li>
          {activeTier === PlanTier.MM2 && (
            <li
              className={classNames({
                active: contractInterval === ANNUAL && billingInterval === MONTHLY,
              })}
            >
              <a
                onClick={() =>
                  this.setState({
                    billingInterval: MONTHLY,
                    contractInterval: ANNUAL,
                    plan: null,
                  })
                }
              >
                Annual (Contract)
              </a>
            </li>
          )}
          <li
            className={classNames({
              active: contractInterval === ANNUAL && billingInterval === ANNUAL,
            })}
          >
            <a
              onClick={() =>
                this.setState({
                  billingInterval: ANNUAL,
                  contractInterval: ANNUAL,
                  plan: null,
                })
              }
            >
              Annual (Upfront)
            </a>
          </li>
        </ul>
      </React.Fragment>
    );

    return (
      <Fragment>
        {header}
        <PlanList
          planId={plan}
          reservedErrors={reservedErrors}
          reservedTransactions={reservedTransactions}
          reservedReplays={reservedReplays}
          reservedSpans={reservedSpans}
          reservedAttachments={reservedAttachments}
          reservedMonitorSeats={reservedMonitorSeats}
          reservedUptime={reservedUptime}
          reservedProfileDuration={reservedProfileDuration}
          plans={planList}
          onPlanChange={this.handlePlanChange}
          onLimitChange={this.handleLimitChange}
        />
      </Fragment>
    );
  }
}

const TabsContainer = styled('div')`
  margin-bottom: ${space(2)};
`;

export default ChangePlanAction;
