import type React from 'react';
import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import Color from 'color';

import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {Input} from 'sentry/components/core/input';
import {Flex, Grid} from 'sentry/components/core/layout';
import {Radio} from 'sentry/components/core/radio';
import {IconWarning} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {DataCategory} from 'sentry/types/core';
import {capitalize} from 'sentry/utils/string/capitalize';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';

import {RESERVED_BUDGET_QUOTA} from 'getsentry/constants';
import {OnDemandBudgetMode, type OnDemandBudgets, type Plan} from 'getsentry/types';
import {formatReservedWithUnits} from 'getsentry/utils/billing';
import {
  getCategoryInfoFromPlural,
  getPlanCategoryName,
  getSingularCategoryName,
  isByteCategory,
} from 'getsentry/utils/dataCategory';
import type {SelectableProduct} from 'getsentry/views/amCheckout/types';
import {displayPrice, displayPriceWithCents} from 'getsentry/views/amCheckout/utils';
import {convertOnDemandBudget} from 'getsentry/views/onDemandBudgets/utils';

const SUGGESTED_SPENDING_CAPS = [300_00, 500_00, 1_000_00, 10_000_00];

type PartialSpendCapUpdate = Partial<Record<DataCategory, number>> & {
  sharedMaxBudget?: number;
};

interface SpendCapSettingsProps {
  activePlan: Plan;
  additionalProducts: Record<
    SelectableProduct,
    {
      reserved: number;
      reservedType: 'budget' | 'volume';
    }
  >;
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

interface BudgetModeSettingsProps
  extends Omit<
    SpendCapSettingsProps,
    'header' | 'currentReserved' | 'additionalProducts'
  > {}

interface InnerSpendCapSettingsProps extends Omit<SpendCapSettingsProps, 'header'> {}

interface SharedSpendCapPriceTableProps
  extends Pick<
    SpendCapSettingsProps,
    'activePlan' | 'currentReserved' | 'additionalProducts'
  > {}
interface SpendCapInputProps extends Pick<SpendCapSettingsProps, 'activePlan'> {
  budgetMode: OnDemandBudgetMode;
  category: DataCategory | null;
  currentSpendingCap: number;
  onUpdate: ({
    newData,
    fromButton,
  }: {
    newData: PartialSpendCapUpdate;
    fromButton?: boolean;
  }) => void;
  reserved: number | null;
}

function formatPaygPricePerUnit({
  paygPpe,
  category,
  pluralName,
  singularName,
  addComma,
}: {
  category: DataCategory;
  paygPpe: number;
  pluralName: string;
  singularName: string;
  addComma?: boolean;
}) {
  const paygPriceMultiplier =
    getCategoryInfoFromPlural(category)?.paygPriceMultiplier ?? 1;
  const multiplierIsOne = paygPriceMultiplier === 1;
  const formattedPrice = displayPriceWithCents({
    cents: paygPpe * paygPriceMultiplier,
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
  const formattedUnits = formatReservedWithUnits(paygPriceMultiplier, category, {
    isAbbreviated: true,
    useUnitScaling: true,
  });
  if (isByteCategory(category)) {
    return tct('[formattedPrice] per [units][addComma]', {
      formattedPrice,
      units: multiplierIsOne ? 'GB' : formattedUnits,
      addComma: addComma ? ', ' : '',
    });
  }
  return tct('[formattedPrice] per [units][addComma]', {
    formattedPrice,
    units: `${multiplierIsOne ? '' : `${formattedUnits} `} ${multiplierIsOne ? singularName : pluralName}`,
    addComma: addComma ? ', ' : '',
  });
}

function SpendCapInput({
  activePlan,
  budgetMode,
  onUpdate,
  currentSpendingCap,
  category,
  reserved,
}: SpendCapInputProps) {
  const [selectedButton, setSelectedButton] = useState<string | null>(
    `button-${currentSpendingCap}`
  );
  // category and reserved should never be null for per category but this makes TS happy
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
          const formattedCap = displayPrice({cents: cap});
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
              isSelected={isSelected}
              aria-label={t('%s suggested %s spending cap', formattedCap, displayName)}
            >
              {formattedCap}
            </StyledButton>
          );
        })}
      </ButtonBar>
      <Currency>
        <StyledInput
          aria-label={t('Custom %s spending cap', displayName)}
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
      </Currency>
    </Flex>
  );
}

function SharedSpendCapPriceTable({
  activePlan,
  currentReserved,
  additionalProducts,
}: SharedSpendCapPriceTableProps) {
  const additionalProductCategories = Object.values(
    activePlan.availableReservedBudgetTypes
  ).flatMap(budgetType => budgetType.dataCategories);
  const baseCategories = activePlan.onDemandCategories.filter(
    category => !additionalProductCategories.includes(category)
  );
  return (
    <PriceTable columns="repeat(3, 1fr)" gap="md 0">
      <strong>{t('Applies to')}</strong>
      <strong>{t('Included volume')}</strong>
      <strong>{t('Additional cost')}</strong>
      {baseCategories.map(category => {
        const reserved = currentReserved[category] ?? 0;
        const paygPpe =
          activePlan.planCategories[category]?.find(bucket => bucket.events === reserved)
            ?.onDemandPrice ?? 0;
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
              {formatPaygPricePerUnit({
                paygPpe,
                category,
                pluralName,
                singularName,
              })}
            </span>
          </Fragment>
        );
      })}
      {Object.values(activePlan.availableReservedBudgetTypes).map(productInfo => {
        // TODO(checkout v3): this will need to be updated for non-budget products
        const checkoutState =
          additionalProducts[productInfo.apiName as unknown as SelectableProduct];

        if (!checkoutState) {
          return null;
        }

        const reserved = checkoutState.reserved
          ? checkoutState.reserved
          : (productInfo.defaultBudget ?? 0);
        const reservedType = checkoutState.reservedType ?? 'budget';

        return (
          <Fragment key={productInfo.apiName}>
            <span>
              {toTitleCase(productInfo.productCheckoutName, {allowInnerUpperCase: true})}
            </span>
            <span>
              {reserved === 0
                ? '-'
                : reservedType === 'budget'
                  ? tct('[reservedBudget] credit', {
                      reservedBudget: displayPrice({cents: reserved}),
                    })
                  : reserved}
            </span>
            <span>
              {checkoutState
                ? productInfo.dataCategories.map((category, index) => {
                    const paygPpe =
                      activePlan.planCategories[category]?.find(
                        bucket => bucket.events === RESERVED_BUDGET_QUOTA
                      )?.onDemandPrice ?? 0;
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
                    return formatPaygPricePerUnit({
                      paygPpe,
                      category,
                      pluralName,
                      singularName,
                      addComma: index !== productInfo.dataCategories.length - 1,
                    });
                  })
                : '-'}
            </span>
          </Fragment>
        );
      })}
    </PriceTable>
  );
}

function InnerSpendCapSettings({
  activePlan,
  onDemandBudgets,
  onUpdate,
  currentReserved,
  additionalProducts,
}: InnerSpendCapSettingsProps) {
  const handleUpdate = ({
    newData,
    fromButton,
  }: {
    newData: PartialSpendCapUpdate;
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

  const budgetTerm = activePlan.budgetTerm;
  const formattedBudgetMode = onDemandBudgets.budgetMode.replace('_', '-');

  const getPerCategoryWarning = (productName: string) => {
    return (
      <PerCategoryWarning>
        <IconWarning size="sm" />{' '}
        {tct(
          'Additional [productName] usage is only available with a shared spending cap',
          {productName: toTitleCase(productName, {allowInnerUpperCase: true})}
        )}
      </PerCategoryWarning>
    );
  };

  let inputs: React.ReactNode = null;
  if (onDemandBudgets.budgetMode === OnDemandBudgetMode.PER_CATEGORY) {
    const additionalProductCategories = Object.values(
      activePlan.availableReservedBudgetTypes
    ).flatMap(budgetType => budgetType.dataCategories);
    const baseCategories = activePlan.onDemandCategories.filter(
      category => !additionalProductCategories.includes(category)
    );
    inputs = (
      <div>
        {baseCategories.map(category => {
          const reserved = currentReserved[category] ?? 0;
          const paygPpe =
            activePlan.planCategories[category]?.find(
              bucket => bucket.events === reserved
            )?.onDemandPrice ?? 0;
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
          const categoryInfo = getCategoryInfoFromPlural(category);
          const hasPerCategory = categoryInfo?.hasPerCategory;
          const productName = categoryInfo?.productName ?? pluralName;
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
                  {hasPerCategory && (
                    <Fragment>
                      ・
                      {formatPaygPricePerUnit({
                        paygPpe,
                        category,
                        pluralName,
                        singularName,
                      })}
                    </Fragment>
                  )}
                </Subtext>
              </div>
              {hasPerCategory ? (
                <SpendCapInput
                  activePlan={activePlan}
                  budgetMode={OnDemandBudgetMode.PER_CATEGORY}
                  category={category}
                  currentSpendingCap={currentBudget}
                  onUpdate={handleUpdate}
                  reserved={reserved}
                />
              ) : (
                getPerCategoryWarning(productName)
              )}
            </CategoryRow>
          );
        })}
        {Object.values(activePlan.availableReservedBudgetTypes).map(productInfo => {
          // TODO(checkout v3): this will need to be updated for non-budget products
          const checkoutState =
            additionalProducts[productInfo.apiName as unknown as SelectableProduct];
          if (!checkoutState) {
            return null;
          }
          const reserved = checkoutState.reserved
            ? checkoutState.reserved
            : (productInfo.defaultBudget ?? 0);
          const reservedType = checkoutState.reservedType ?? 'budget';

          return (
            <CategoryRow key={productInfo.apiName}>
              <div>
                <strong>
                  {toTitleCase(productInfo.productCheckoutName, {
                    allowInnerUpperCase: true,
                  })}
                </strong>
                <Subtext>
                  {reserved === 0
                    ? t('None included')
                    : reservedType === 'budget'
                      ? tct('[reservedBudget] credit included', {
                          reservedBudget: displayPrice({cents: reserved}),
                        })
                      : tct('[reserved] [pluralName] included', {
                          reserved,
                          pluralName: productInfo.productCheckoutName,
                        })}
                </Subtext>
              </div>
              {getPerCategoryWarning(productInfo.productCheckoutName)}
            </CategoryRow>
          );
        })}
      </div>
    );
  } else {
    inputs = (
      <Fragment>
        <SpendCapInput
          activePlan={activePlan}
          budgetMode={OnDemandBudgetMode.SHARED}
          category={null}
          currentSpendingCap={onDemandBudgets.sharedMaxBudget ?? 0}
          onUpdate={handleUpdate}
          reserved={null}
        />
        <SharedSpendCapPriceTable
          activePlan={activePlan}
          currentReserved={currentReserved}
          additionalProducts={additionalProducts}
        />
      </Fragment>
    );
  }

  return (
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
      {inputs}
      <StartingRate
        alignSelf={
          onDemandBudgets.budgetMode === OnDemandBudgetMode.PER_CATEGORY ? 'end' : 'start'
        }
      >
        {t('* starting rate')}
      </StartingRate>
    </InnerContainer>
  );
}

function BudgetModeSettings({
  activePlan,
  onDemandBudgets,
  onUpdate,
}: BudgetModeSettingsProps) {
  const hasBudgetModes = activePlan.hasOnDemandModes;

  if (!hasBudgetModes) {
    return null;
  }

  return (
    <Grid columns="repeat(2, 1fr)" gap="xl">
      {Object.values(OnDemandBudgetMode).map(budgetMode => {
        const budgetModeName = capitalize(budgetMode.replace('_', '-'));
        const isSelected = onDemandBudgets.budgetMode === budgetMode;
        const nextOnDemandBudget = convertOnDemandBudget(onDemandBudgets, budgetMode);
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
              readOnly
            />
          </BudgetMode>
        );
      })}
    </Grid>
  );
}

function SpendCapSettings({
  header,
  activePlan,
  onDemandBudgets,
  onUpdate,
  currentReserved,
  isOpen,
  additionalProducts,
}: SpendCapSettingsProps) {
  return (
    <Flex direction="column">
      {header}
      {isOpen && (
        <Grid gap="2xl">
          <Subtext>
            {t(
              'You get included allowances each month (shown below). Any usage beyond your included amounts is charged at the end of your monthly cycle.'
            )}
          </Subtext>
          <BudgetModeSettings
            activePlan={activePlan}
            onDemandBudgets={onDemandBudgets}
            onUpdate={onUpdate}
          />
          <InnerSpendCapSettings
            activePlan={activePlan}
            onDemandBudgets={onDemandBudgets}
            onUpdate={onUpdate}
            currentReserved={currentReserved}
            additionalProducts={additionalProducts}
          />
        </Grid>
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
  background: ${p =>
    p.isSelected
      ? Color(p.theme.active).lighten(0.05).alpha(0.05).toString()
      : p.theme.background};
  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => (p.isSelected ? p.theme.active : p.theme.border)};
  color: ${p => (p.isSelected ? p.theme.activeText : p.theme.textColor)};
  cursor: pointer;
`;

const InnerContainer = styled('div')`
  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => p.theme.border};
  padding: ${p => p.theme.space.xl};
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.xl};
  background: ${p => p.theme.background};
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
  text-align: right;
`;

const CategoryRow = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${p => p.theme.space.lg};
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

const PerCategoryWarning = styled(Subtext)`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.sm};
`;

const Currency = styled('div')`
  &::before {
    position: absolute;
    padding: 9px ${p => p.theme.space.lg};
    content: '$';
    color: ${p => p.theme.subText};
    font-size: ${p => p.theme.fontSize.md};
  }
`;
