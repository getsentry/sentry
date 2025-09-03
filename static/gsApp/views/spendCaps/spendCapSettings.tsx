import type React from 'react';
import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {Input} from 'sentry/components/core/input';
import {Flex, Grid} from 'sentry/components/core/layout';
import {Radio} from 'sentry/components/core/radio';
import {t, tct} from 'sentry/locale';
import type {DataCategory} from 'sentry/types/core';
import {capitalize} from 'sentry/utils/string/capitalize';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';

import {OnDemandBudgetMode, type OnDemandBudgets, type Plan} from 'getsentry/types';
import {formatReservedWithUnits} from 'getsentry/utils/billing';
import {
  getCategoryInfoFromPlural,
  getPlanCategoryName,
  getSingularCategoryName,
  isByteCategory,
} from 'getsentry/utils/dataCategory';
import {displayPrice, displayPriceWithCents} from 'getsentry/views/amCheckout/utils';
import {convertOnDemandBudget} from 'getsentry/views/onDemandBudgets/utils';

interface SpendCapSettingsProps {
  activePlan: Plan;
  currentReserved: Partial<Record<DataCategory, number>>;
  header: React.ReactNode;
  onDemandBudgets: OnDemandBudgets;
  onUpdate: ({
    onDemandBudgets,
    fromButton,
  }: {
    onDemandBudgets: OnDemandBudgets;
    fromButton?: boolean;
  }) => void;
  isOpen?: boolean;
}

interface SetSpendingCapsProps extends Omit<SpendCapSettingsProps, 'header'> {}

interface SpendingCapInputProps {
  activePlan: Plan;
  budgetMode: OnDemandBudgetMode;
  category: DataCategory | null;
  currentSpendingCap: number;
  onUpdate: ({
    newData,
    fromButton,
  }: {
    newData: Partial<Record<DataCategory, number>> & {
      sharedMaxBudget?: number;
    };
    fromButton?: boolean;
  }) => void;
  reserved: number | null;
}

const SUGGESTED_SPENDING_CAPS = [300_00, 500_00, 1_000_00, 10_000_00];

function SpendingCapInput({
  activePlan,
  budgetMode,
  onUpdate,
  currentSpendingCap,
  category,
  reserved,
}: SpendingCapInputProps) {
  const [selectedButton, setSelectedButton] = useState<string | null>(
    `button-${currentSpendingCap}`
  );
  const isPerCategory =
    budgetMode === OnDemandBudgetMode.PER_CATEGORY &&
    category !== null &&
    reserved !== null;
  const inputName = isPerCategory ? category : 'sharedMaxBudget';
  const displayName = isPerCategory
    ? getPlanCategoryName({
        plan: activePlan,
        category,
        capitalize: false,
      })
    : 'shared';

  const coerceValue = (value: number): string => {
    return (value / 100).toString();
  };

  const parseInputValue = (e: React.ChangeEvent<HTMLInputElement>): number => {
    let value = parseInt(e.target.value, 10) || 0;
    value = Math.max(value, 0);
    const cents = value * 100;
    return cents;
  };

  return (
    <Flex align="center" justify="start" gap="md">
      <ButtonBar merged gap="0">
        {SUGGESTED_SPENDING_CAPS.map(cap => {
          const isSelected = selectedButton === `button-${cap}`;
          return (
            <StyledButton
              key={cap}
              onClick={() => {
                setSelectedButton(`button-${cap}`);
                onUpdate({
                  newData: {[inputName]: cap},
                  fromButton: true,
                });
              }}
              aria-checked={isSelected}
              isSelected={isSelected} // TODO(isabella): this should be a pressed state
            >
              {displayPrice({cents: cap})}
            </StyledButton>
          );
        })}
      </ButtonBar>
      <StyledInput
        aria-label={t('Custom spending cap for %s', {displayName})}
        name={`spending-cap-${inputName}`}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        placeholder="300"
        value={coerceValue(currentSpendingCap)}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          const parsedBudget = parseInputValue(e);
          onUpdate({
            newData: {[inputName]: parsedBudget},
            fromButton: false,
          });
          setSelectedButton(`button-${parsedBudget}`);
        }}
      />
    </Flex>
  );
}

function SetSpendingCaps({
  activePlan,
  onDemandBudgets,
  onUpdate,
  currentReserved,
}: SetSpendingCapsProps) {
  const handleUpdate = ({
    newData,
    fromButton,
  }: {
    newData: Partial<Record<DataCategory, number>> & {
      sharedMaxBudget?: number;
    };
    fromButton?: boolean;
  }) => {
    if (onDemandBudgets.budgetMode === OnDemandBudgetMode.PER_CATEGORY) {
      onUpdate({
        onDemandBudgets: {
          ...onDemandBudgets,
          budgets: {
            ...onDemandBudgets.budgets,
            ...newData,
          },
        },
        fromButton,
      });
    } else {
      onUpdate({
        onDemandBudgets: {
          ...onDemandBudgets,
          ...newData,
        },
        fromButton,
      });
    }
  };

  if (onDemandBudgets.budgetMode === OnDemandBudgetMode.PER_CATEGORY) {
    return (
      <div>
        {activePlan.onDemandCategories
          .filter(category => getCategoryInfoFromPlural(category)?.hasPerCategory)
          .map(category => {
            const reserved = currentReserved[category] ?? 0;
            const paygPpe = activePlan.planCategories[category]?.find(
              bucket => bucket.events === reserved
            )?.onDemandPrice;
            const pluralName = getPlanCategoryName({
              plan: activePlan,
              category,
              capitalize: false,
            });
            const singularName = getSingularCategoryName({
              plan: activePlan,
              category,
              capitalize: false,
            });
            const currentBudget = onDemandBudgets.budgets[category] ?? 0;
            const paygPriceMultiplier =
              getCategoryInfoFromPlural(category)?.paygPriceMultiplier ?? 1;
            return (
              <CategoryRow key={category}>
                <div>
                  <strong>{toTitleCase(pluralName, {allowInnerUpperCase: true})}</strong>
                  <Subtext>
                    {reserved === 0
                      ? t('None included')
                      : tct('[reserved] [pluralName] included', {
                          reserved: formatReservedWithUnits(reserved, category, {
                            isAbbreviated: false,
                            useUnitScaling: true,
                          }),
                          pluralName,
                        })}
                    ・
                    {tct('*[paygPrice] per [units]', {
                      paygPrice: displayPriceWithCents({
                        cents: (paygPpe ?? 0) * paygPriceMultiplier,
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 3,
                      }),
                      units: `${paygPriceMultiplier === 1 && !isByteCategory(category) ? '' : `${formatReservedWithUnits(paygPriceMultiplier, category, {isAbbreviated: true})} `} ${isByteCategory(category) ? '' : paygPriceMultiplier === 1 ? singularName : pluralName}`,
                    })}
                  </Subtext>
                </div>
                <SpendingCapInput
                  activePlan={activePlan}
                  budgetMode={OnDemandBudgetMode.PER_CATEGORY}
                  category={category}
                  currentSpendingCap={currentBudget}
                  onUpdate={handleUpdate}
                  reserved={reserved}
                />
              </CategoryRow>
            );
          })}
      </div>
    );
  }

  return (
    <Fragment>
      <SpendingCapInput
        activePlan={activePlan}
        budgetMode={OnDemandBudgetMode.SHARED}
        category={null}
        currentSpendingCap={onDemandBudgets.sharedMaxBudget ?? 0}
        onUpdate={handleUpdate}
        reserved={null}
      />
      <SpendCapPriceTable activePlan={activePlan} currentReserved={currentReserved} />
    </Fragment>
  );
}

function SpendCapPriceTable({
  activePlan,
  currentReserved,
}: {
  activePlan: Plan;
  currentReserved: Partial<Record<DataCategory, number>>;
}) {
  return (
    <PriceTable columns="repeat(3, 1fr)" gap="md 0">
      <strong>{t('Applies to')}</strong>
      <strong>{t('Included volume')}</strong>
      <strong>{t('Additional cost')}</strong>
      {activePlan.onDemandCategories.map(category => {
        const reserved = currentReserved[category] ?? 0;
        const paygPpe = activePlan.planCategories[category]?.find(
          bucket => bucket.events === reserved
        )?.onDemandPrice;
        const paygPriceMultiplier =
          getCategoryInfoFromPlural(category)?.paygPriceMultiplier ?? 1;
        const pluralName = getPlanCategoryName({
          plan: activePlan,
          category,
          capitalize: false,
        });
        const singularName = getSingularCategoryName({
          plan: activePlan,
          category,
          capitalize: false,
        });
        return (
          <Fragment key={category}>
            <span>{toTitleCase(pluralName, {allowInnerUpperCase: true})}</span>
            <span>
              {reserved === 0
                ? '-'
                : formatReservedWithUnits(reserved, category, {
                    isAbbreviated: false,
                    useUnitScaling: true,
                  })}{' '}
              {reserved === 0 ? '' : reserved === 1 ? singularName : pluralName}
            </span>
            <span>
              {tct('[paygPrice] per [units]', {
                paygPrice: displayPriceWithCents({
                  cents: (paygPpe ?? 0) * paygPriceMultiplier,
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 3,
                }),
                units: `${paygPriceMultiplier === 1 && !isByteCategory(category) ? '' : `${formatReservedWithUnits(paygPriceMultiplier, category, {isAbbreviated: true})} `} ${isByteCategory(category) ? '' : paygPriceMultiplier === 1 ? singularName : pluralName}`,
              })}
            </span>
          </Fragment>
        );
      })}
    </PriceTable>
  );
}

function SpendCapSettings({
  header,
  activePlan,
  onDemandBudgets,
  onUpdate,
  currentReserved,
  isOpen,
}: SpendCapSettingsProps) {
  const budgetTerm = activePlan.budgetTerm;
  const hasBudgetModes = activePlan.hasOnDemandModes;
  const formattedBudgetMode = onDemandBudgets.budgetMode.replace('_', '-');

  return (
    <Flex direction="column">
      {header}
      {isOpen && (
        <Fragment>
          <Subtext>
            {t(
              'You get included allowances each month (shown below). Any usage beyond your included amounts is charged at the end of your monthly cycle.'
            )}
          </Subtext>
          {hasBudgetModes && (
            <StyledGrid columns="repeat(2, 1fr)" gap="xl">
              {Object.values(OnDemandBudgetMode).map(budgetMode => {
                const budgetModeName = capitalize(budgetMode.replace('_', '-'));
                const isSelected = onDemandBudgets.budgetMode === budgetMode;
                const nextOnDemandBudget = convertOnDemandBudget(
                  onDemandBudgets,
                  budgetMode
                );
                return (
                  <BudgetMode
                    key={budgetMode}
                    isSelected={isSelected}
                    onClick={() => {
                      onUpdate({
                        onDemandBudgets: nextOnDemandBudget,
                      });
                    }}
                  >
                    <strong>
                      {tct('[budgetMode] spending caps', {
                        budgetMode: budgetModeName,
                      })}
                    </strong>
                    <StyledRadio
                      id={budgetMode}
                      name="budget-mode"
                      aria-label={`${budgetModeName} spending cap mode`}
                      value={budgetMode}
                      checked={isSelected}
                    />
                  </BudgetMode>
                );
              })}
            </StyledGrid>
          )}
          <InnerContainer>
            <div>
              <Subtitle>
                {tct('Set [budgetMode] monthly spending caps', {
                  budgetMode: formattedBudgetMode,
                })}
              </Subtitle>
              <Subtext>
                {t(
                  'Set a maximum monthly spend to control costs. If you reach this limit, data collection pauses until the next billing cycle.'
                )}
              </Subtext>
            </div>
            <ExampleContainer>
              <strong>{t('Example:')}</strong>
              <p>
                {tct(
                  "With a $300 cap, if you use $150 in [budgetTerm] beyond your included volumes, you'll be charged exactly $150. Your service continues normally until you hit the $300 limit.",
                  {budgetTerm}
                )}
              </p>
            </ExampleContainer>
            <SetSpendingCaps
              activePlan={activePlan}
              onDemandBudgets={onDemandBudgets}
              onUpdate={onUpdate}
              currentReserved={currentReserved}
            />
            <StartingRate
              alignSelf={
                onDemandBudgets.budgetMode === OnDemandBudgetMode.PER_CATEGORY
                  ? 'end'
                  : 'start'
              }
            >
              {t('* starting rate')}
            </StartingRate>
          </InnerContainer>
        </Fragment>
      )}
    </Flex>
  );
}

export default SpendCapSettings;

const StyledRadio = styled(Radio)`
  background: ${p => p.theme.background};
`;

const Subtext = styled('p')`
  margin: 0;
  color: ${p => p.theme.subText};
`;

const Subtitle = styled('h2')`
  margin: 0;
  font-size: ${p => p.theme.fontSize.md};
`;

const BudgetMode = styled('div')<{isSelected: boolean}>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${p => p.theme.space.xl};
  background: ${p => (p.isSelected ? `${p.theme.active}05` : p.theme.background)};
  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => (p.isSelected ? p.theme.active : p.theme.border)};
  color: ${p => (p.isSelected ? p.theme.activeText : p.theme.textColor)};
  cursor: pointer;
`;

const StyledGrid = styled(Grid)`
  margin-top: ${p => p.theme.space['2xl']};
`;

const InnerContainer = styled('div')`
  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => p.theme.border};
  padding: ${p => p.theme.space.xl};
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.xl};
  background: ${p => p.theme.background};
  margin-top: ${p => p.theme.space['2xl']};
`;

const ExampleContainer = styled('div')`
  background: ${p => p.theme.blue100};
  color: ${p => p.theme.activeText};
  padding: ${p => p.theme.space.xl};

  > p {
    margin: 0;
  }
`;

// TODO(isabella): fix text color
const StyledButton = styled(Button)<{isSelected: boolean}>`
  color: ${p => (p.isSelected ? p.theme.activeText : p.theme.gray500)};
  &:hover {
    color: ${p => p.theme.activeText};
  }
`;

const StyledInput = styled(Input)`
  width: 124px;
`;

const CategoryRow = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${p => p.theme.space.sm};
  padding: ${p => p.theme.space.lg} 0;

  &:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.border};
  }
`;

const PriceTable = styled(Grid)`
  & > * {
    border-bottom: 1px solid ${p => p.theme.border};
    padding-bottom: ${p => p.theme.space.md};
  }
`;

const StartingRate = styled(Subtext)<{alignSelf: 'start' | 'end'}>`
  align-self: ${p => p.alignSelf};
  font-size: ${p => p.theme.fontSize.sm};
`;
