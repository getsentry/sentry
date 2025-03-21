import {Fragment} from 'react';
import styled from '@emotion/styled';

import SelectField from 'sentry/components/forms/fields/selectField';
import {space} from 'sentry/styles/space';
import {DataCategory} from 'sentry/types/core';

import type {Plan} from 'getsentry/types';
import {getPlanCategoryName} from 'getsentry/utils/dataCategory';
import formatCurrency from 'getsentry/utils/formatCurrency';
import titleCase from 'getsentry/utils/titleCase';

type LimitName =
  | 'reservedErrors'
  | 'reservedAttachments'
  | 'reservedReplays'
  | 'reservedTransactions'
  | 'reservedMonitorSeats'
  | 'reservedUptime'
  | 'reservedSpans'
  | 'reservedProfileDuration'
  | 'reservedProfileDurationUI';

type Props = {
  onLimitChange: (limit: LimitName, value: number) => void;
  onPlanChange: (planId: string) => void;
  planId: null | string;
  plans: Plan[];
  reservedAttachments: null | number;
  reservedErrors: null | number;
  reservedMonitorSeats: null | number;
  reservedProfileDuration: null | number;
  reservedProfileDurationUI: null | number;
  reservedReplays: null | number;
  reservedSpans: null | number;
  reservedTransactions: null | number;
  reservedUptime: null | number;
};

const configurableCategories: DataCategory[] = [
  DataCategory.ERRORS,
  DataCategory.REPLAYS,
  DataCategory.TRANSACTIONS,
  DataCategory.ATTACHMENTS,
  DataCategory.MONITOR_SEATS,
  DataCategory.UPTIME,
  DataCategory.SPANS,
  DataCategory.PROFILE_DURATION,
  DataCategory.PROFILE_DURATION_UI,
];

function PlanList({
  plans,
  planId,
  reservedErrors,
  reservedTransactions,
  reservedReplays,
  reservedAttachments,
  reservedMonitorSeats,
  reservedUptime,
  reservedProfileDuration,
  reservedProfileDurationUI,
  reservedSpans,
  onPlanChange,
  onLimitChange,
}: Props) {
  const changeValue = {
    6000000: '6M',
    5000000: '5M',
    4000000: '4M',
    3000000: '3M',
    1500000: '1.5M',
    500000: '500k',
    100000: '100K',
  };
  if (!plans.length) {
    return null;
  }
  function handleLimitChange(limit: LimitName) {
    return function handleChange(value: string) {
      onLimitChange(limit, parseInt(value, 10));
    };
  }
  const activePlan = plans.find(plan => plan.id === planId);

  return (
    <Fragment>
      {plans.map(plan => (
        <div key={plan.id}>
          <PlanLabel>
            <div>
              <input
                data-test-id={`change-plan-radio-btn-${plan.id}`}
                type="radio"
                name="cancelAtPeriodEnd"
                value={plan.id}
                onChange={() => onPlanChange(plan.id)}
              />
            </div>
            <div>
              <strong>
                {plan.name}{' '}
                {
                  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                  changeValue[plan.reservedMinimum] ?? ''
                }
              </strong>{' '}
              <SubText>— {plan.id}</SubText>
              <br />
              <small>
                {formatCurrency(plan.price)} /{' '}
                {plan.billingInterval === 'annual' ? 'annually' : 'monthly'}
              </small>
            </div>
          </PlanLabel>
        </div>
      ))}
      {activePlan &&
        (
          activePlan?.planCategories.transactions ||
          activePlan?.planCategories.spans ||
          []
        ).length > 1 && (
          <div>
            <h4>Reserved Volumes</h4>
            {activePlan.categories
              .filter(category =>
                configurableCategories.includes(category as DataCategory)
              )
              .map(category => {
                const titleCategory = getPlanCategoryName({plan: activePlan, category});
                const reserved = `reserved${
                  titleCase(category[0]!) + category.substring(1, category.length)
                }`;
                const label =
                  category === DataCategory.ATTACHMENTS
                    ? `${titleCategory} (GB)`
                    : titleCategory;
                let fieldValue: any;
                switch (category) {
                  case DataCategory.ERRORS:
                    fieldValue = reservedErrors;
                    break;
                  case DataCategory.TRANSACTIONS:
                    fieldValue = reservedTransactions;
                    break;
                  case DataCategory.SPANS:
                    fieldValue = reservedSpans;
                    break;
                  case DataCategory.REPLAYS:
                    fieldValue = reservedReplays;
                    break;
                  case DataCategory.ATTACHMENTS:
                    fieldValue = reservedAttachments;
                    break;
                  case DataCategory.MONITOR_SEATS:
                    fieldValue = reservedMonitorSeats;
                    break;
                  case DataCategory.PROFILE_DURATION:
                    fieldValue = reservedProfileDuration;
                    break;
                  case DataCategory.PROFILE_DURATION_UI:
                    fieldValue = reservedProfileDurationUI;
                    break;
                  case DataCategory.UPTIME:
                    fieldValue = reservedUptime;
                    break;
                  default:
                    throw new Error(`Category ${category} is not supported`);
                }
                return (
                  <SelectField
                    key={`test-${category}`}
                    inline={false}
                    stacked
                    name={`${reserved}`}
                    label={label}
                    value={fieldValue}
                    options={(activePlan.planCategories[category] || []).map(level => ({
                      label: level.events.toLocaleString(),
                      value: level.events,
                    }))}
                    required
                    onChange={handleLimitChange(reserved as LimitName)}
                  />
                );
              })}
          </div>
        )}
    </Fragment>
  );
}

const PlanLabel = styled('label')`
  margin-bottom: 10px;

  display: flex;
  align-items: flex-start;

  & > div {
    margin-right: ${space(3)};
  }
`;

const SubText = styled('small')`
  font-weight: normal;
  color: #999;
`;

export default PlanList;
