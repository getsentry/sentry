import {Component, Fragment} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import {Input} from 'sentry/components/core/input';
import {Container} from 'sentry/components/core/layout';
import {Heading} from 'sentry/components/core/text';
import {Tooltip} from 'sentry/components/core/tooltip';
import {DATA_CATEGORY_INFO} from 'sentry/constants';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DataCategoryExact} from 'sentry/types/core';
import type {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import oxfordizeArray from 'sentry/utils/oxfordizeArray';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

import {CronsOnDemandStepWarning} from 'getsentry/components/cronsOnDemandStepWarning';
import type {OnDemandBudgets, Plan, Subscription} from 'getsentry/types';
import {OnDemandBudgetMode, PlanTier} from 'getsentry/types';
import {displayBudgetName, getOnDemandCategories} from 'getsentry/utils/billing';
import {getPlanCategoryName} from 'getsentry/utils/dataCategory';
import {parseOnDemandBudgetsFromSubscription} from 'getsentry/views/onDemandBudgets/utils';
import EmbeddedSpendLimitSettings from 'getsentry/views/spendLimits/embeddedSettings';

function coerceValue(value: number): number {
  return value / 100;
}

function parseInputValue(e: React.ChangeEvent<HTMLInputElement>) {
  let value = parseInt(e.target.value, 10) || 0;
  value = Math.max(value, 0);
  const cents = value * 100;
  return cents;
}

type Props = {
  activePlan: Plan;
  currentBudgetMode: OnDemandBudgetMode;
  onDemandBudget: OnDemandBudgets;
  onDemandEnabled: boolean;
  onDemandSupported: boolean;
  organization: Organization;
  setBudgetMode: (nextMode: OnDemandBudgetMode) => void;
  setOnDemandBudget: (onDemandBudget: OnDemandBudgets) => void;
  subscription: Subscription;
};

class OnDemandBudgetEdit extends Component<Props> {
  onDemandUnsupportedCopy = () => {
    const {subscription} = this.props;
    return tct('[budgetType] is not supported for your account.', {
      budgetType: displayBudgetName(subscription.planDetails, {title: true}),
    });
  };
  renderInputFields = (displayBudgetMode: OnDemandBudgetMode) => {
    const {
      onDemandBudget,
      setOnDemandBudget,
      onDemandSupported,
      activePlan,
      organization,
      subscription,
    } = this.props;
    const cronCategoryName = DATA_CATEGORY_INFO[DataCategoryExact.MONITOR_SEAT].plural;

    const perCategoryCategories = getOnDemandCategories({
      plan: activePlan,
      budgetMode: OnDemandBudgetMode.PER_CATEGORY,
    });
    const addOnDataCategories = Object.values(activePlan.addOnCategories).flatMap(
      addOnInfo => addOnInfo.dataCategories
    );

    if (
      onDemandBudget.budgetMode === OnDemandBudgetMode.SHARED &&
      displayBudgetMode === OnDemandBudgetMode.SHARED
    ) {
      return (
        <InputFields style={{alignSelf: 'center'}}>
          <Tooltip disabled={onDemandSupported} title={this.onDemandUnsupportedCopy()}>
            <InputDiv>
              <div>
                <Description>{t('Monthly Budget')}</Description>
                {subscription.planTier !== PlanTier.AM3 && (
                  <MediumTitle>{t('All Usage')}</MediumTitle>
                )}
              </div>
              <Currency>
                <OnDemandInput
                  disabled={!onDemandSupported}
                  aria-label={
                    subscription.planDetails.budgetTerm === 'pay-as-you-go'
                      ? t('Pay-as-you-go max budget')
                      : t('Shared max budget')
                  }
                  name="sharedMaxBudget"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={7}
                  placeholder="e.g. 50"
                  value={coerceValue(onDemandBudget.sharedMaxBudget)}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setOnDemandBudget({
                      ...onDemandBudget,
                      sharedMaxBudget: parseInputValue(e),
                    });
                  }}
                />
              </Currency>
            </InputDiv>
          </Tooltip>
          <CronsOnDemandStepWarning
            currentOnDemand={onDemandBudget.sharedMaxBudget ?? 0}
            activePlan={activePlan}
            organization={organization}
            subscription={subscription}
          />
        </InputFields>
      );
    }

    if (
      onDemandBudget.budgetMode === OnDemandBudgetMode.PER_CATEGORY &&
      displayBudgetMode === OnDemandBudgetMode.PER_CATEGORY
    ) {
      const nonPerCategory = [
        ...activePlan.onDemandCategories
          .filter(
            category =>
              !perCategoryCategories.includes(category) &&
              !addOnDataCategories.includes(category)
          )
          .map(category =>
            getPlanCategoryName({plan: activePlan, category, capitalize: false})
          ),
        ...Object.values(activePlan.addOnCategories)
          .filter(
            addOnInfo => subscription.addOns?.[addOnInfo.apiName]?.isAvailable ?? false
          )
          .map(addOnInfo =>
            toTitleCase(addOnInfo.productName, {allowInnerUpperCase: true})
          ),
      ];
      return (
        <InputFields>
          {perCategoryCategories.map(category => {
            const categoryBudgetKey = `${category}Budget`;
            const displayName = getPlanCategoryName({plan: activePlan, category});
            return (
              <Fragment key={category}>
                <Tooltip
                  disabled={onDemandSupported}
                  title={this.onDemandUnsupportedCopy()}
                >
                  <InputDiv>
                    <div>
                      <MediumTitle>{displayName}</MediumTitle>
                      <Description>{t('Monthly Budget')}</Description>
                    </div>
                    <Currency>
                      <OnDemandInput
                        disabled={!onDemandSupported}
                        aria-label={`${displayName} budget`}
                        name={categoryBudgetKey}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={7}
                        placeholder="e.g. 50"
                        value={coerceValue(onDemandBudget.budgets[category] ?? 0)}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          const inputValue = parseInputValue(e);
                          const updatedBudgets = {
                            ...onDemandBudget.budgets,
                            [category]: inputValue,
                          };
                          setOnDemandBudget({
                            ...onDemandBudget,
                            budgets: updatedBudgets,
                          });
                        }}
                      />
                    </Currency>
                  </InputDiv>
                </Tooltip>
              </Fragment>
            );
          })}
          <CronsOnDemandStepWarning
            currentOnDemand={onDemandBudget.budgets[cronCategoryName] ?? 0}
            activePlan={activePlan}
            organization={organization}
            subscription={subscription}
          />
          {activePlan.onDemandCategories.length !== perCategoryCategories.length && (
            <Alert variant="warning">
              {tct(
                'Additional [oxfordCategories] usage [isOrAre] only available through a shared [budgetTerm] budget. To enable [budgetTerm] usage switch to a shared [budgetTerm] budget.',
                {
                  budgetTerm: displayBudgetName(activePlan),
                  isOrAre: nonPerCategory.length === 1 ? t('is') : t('are'),
                  oxfordCategories: oxfordizeArray(nonPerCategory),
                }
              )}
            </Alert>
          )}
        </InputFields>
      );
    }

    return null;
  };

  render() {
    const {subscription, organization} = this.props;

    const addOnDataCategories = Object.values(
      subscription.planDetails.addOnCategories
    ).flatMap(addOn => addOn.dataCategories);
    const currentReserved = Object.fromEntries(
      Object.entries(subscription.categories)
        .filter(([category]) => !addOnDataCategories.includes(category as DataCategory))
        .map(([category, categoryInfo]) => [category, categoryInfo.reserved ?? 0])
    );

    return (
      <Container padding="2xl">
        <EmbeddedSpendLimitSettings
          organization={organization}
          subscription={subscription}
          header={
            <Heading as="h2" size="xl">
              {tct('Set your [budgetTerm] limit', {
                budgetTerm: displayBudgetName(subscription.planDetails),
              })}
            </Heading>
          }
          activePlan={subscription.planDetails}
          initialOnDemandBudgets={parseOnDemandBudgetsFromSubscription(subscription)}
          currentReserved={currentReserved}
          addOns={subscription.addOns ?? {}}
          onUpdate={({onDemandBudgets}) => {
            this.props.setOnDemandBudget(onDemandBudgets);
          }}
        />
      </Container>
    );
  }
}

const InputFields = styled('div')`
  color: ${p => p.theme.gray400};
  font-size: ${p => p.theme.fontSize.md};
  margin-bottom: 1px;
`;

const Description = styled(TextBlock)`
  font-size: ${p => p.theme.fontSize.md};
  color: ${p => p.theme.subText};
  margin: 0;
`;

const Currency = styled('div')`
  &::before {
    position: absolute;
    padding: 9px ${space(1.5)};
    content: '$';
    color: ${p => p.theme.subText};
    font-weight: bold;
    font-size: ${p => p.theme.fontSize.md};
  }
`;

const OnDemandInput = styled(Input)`
  padding-left: ${space(4)};
  color: ${p => p.theme.tokens.content.primary};
  max-width: 140px;
  height: 36px;
`;

const MediumTitle = styled('div')`
  font-size: ${p => p.theme.fontSize.md};
`;

const InputDiv = styled('div')`
  display: grid;
  grid-template-columns: repeat(2, auto);
  justify-content: space-between;
  gap: ${space(0.5)};
  align-items: center;
  padding: ${space(1)} 0;
`;

export default OnDemandBudgetEdit;
