import type React from 'react';
import {Fragment} from 'react';
import styled from '@emotion/styled';
import upperFirst from 'lodash/upperFirst';

import {Input} from 'sentry/components/core/input';
import {Container, Flex, Grid} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {IconWarning} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {capitalize} from 'sentry/utils/string/capitalize';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';

import {RESERVED_BUDGET_QUOTA} from 'getsentry/constants';
import {
  AddOnCategory,
  OnDemandBudgetMode,
  ReservedBudgetCategoryType,
  type OnDemandBudgets,
  type Plan,
} from 'getsentry/types';
import {formatReservedWithUnits, isAm2Plan} from 'getsentry/utils/billing';
import {
  getCategoryInfoFromPlural,
  getPlanCategoryName,
  getSingularCategoryName,
} from 'getsentry/utils/dataCategory';
import CheckoutOption from 'getsentry/views/amCheckout/checkoutOption';
import {getProductCheckoutDescription} from 'getsentry/views/amCheckout/steps/productSelect';
import {renderPerformanceHovercard} from 'getsentry/views/amCheckout/steps/volumeSliders';
import type {SelectableProduct} from 'getsentry/views/amCheckout/types';
import {
  displayPrice,
  displayPriceWithCents,
  getBucket,
} from 'getsentry/views/amCheckout/utils';
import {convertOnDemandBudget} from 'getsentry/views/onDemandBudgets/utils';

type PartialSpendLimitUpdate = Partial<Record<DataCategory, number>> & {
  sharedMaxBudget?: number;
};

interface SpendLimitSettingsProps {
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
  onUpdate: ({onDemandBudgets}: {onDemandBudgets: OnDemandBudgets}) => void;
  organization: Organization;
  footer?: React.ReactNode;
  isOpen?: boolean;
}

interface BudgetModeSettingsProps
  extends Omit<
    SpendLimitSettingsProps,
    'header' | 'currentReserved' | 'additionalProducts' | 'organization'
  > {}

interface InnerSpendLimitSettingsProps extends Omit<SpendLimitSettingsProps, 'header'> {}

interface SharedSpendLimitPriceTableProps
  extends Pick<
    SpendLimitSettingsProps,
    'activePlan' | 'currentReserved' | 'additionalProducts' | 'organization'
  > {}
interface SpendLimitInputProps extends Pick<SpendLimitSettingsProps, 'activePlan'> {
  budgetMode: OnDemandBudgetMode;
  category: DataCategory | null;
  currentSpendingLimit: number;
  onUpdate: ({newData}: {newData: PartialSpendLimitUpdate}) => void;
  reserved: number | null;
}

function formatPaygPricePerUnit({paygPpe}: {paygPpe: number}) {
  const formattedPrice = displayPriceWithCents({
    cents: paygPpe,
    minimumFractionDigits: 0,
    maximumFractionDigits: 8,
  });
  return formattedPrice;
}

function getPaygPpe({
  activePlan,
  category,
  reserved,
}: {
  activePlan: Plan;
  category: DataCategory;
  reserved: number;
}) {
  const bucket = getBucket({
    buckets: activePlan.planCategories[category],
    events: reserved === RESERVED_BUDGET_QUOTA ? reserved : reserved + 1, // +1 to get the next bucket, if any
    shouldMinimize: false,
  });
  return bucket.onDemandPrice ?? 0;
}

function SpendLimitInput({
  activePlan,
  budgetMode,
  onUpdate,
  currentSpendingLimit,
  category,
  reserved,
}: SpendLimitInputProps) {
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
    <Currency>
      <StyledInput
        aria-label={t('Custom %s spending limit', displayName)}
        name={`spending-limit-${inputName}`}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        placeholder="300"
        value={coerceValue(currentSpendingLimit)}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          const parsedBudget = parseInputValue(e);
          onUpdate({
            newData: {[inputName]: parsedBudget},
          });
        }}
      />
    </Currency>
  );
}

function SharedSpendLimitPriceTableRow({children}: {children: React.ReactNode}) {
  return (
    <Grid columns="max-content 1fr max-content" align="center">
      {children}
    </Grid>
  );
}

function SharedSpendLimitPriceTable({
  activePlan,
  currentReserved,
  additionalProducts,
  organization,
}: SharedSpendLimitPriceTableProps) {
  const addOnCategories = Object.values(activePlan.addOnCategories).flatMap(
    addOnInfo => addOnInfo.dataCategories
  );
  const baseCategories = activePlan.onDemandCategories.filter(
    category => !addOnCategories.includes(category)
  );

  return (
    <Flex
      direction="column"
      gap="xl"
      background="secondary"
      border="primary"
      radius="md"
      padding="lg xl"
    >
      <Grid gap="lg" columns={{xs: '1fr', md: 'repeat(2, 1fr)'}}>
        {baseCategories.map(category => {
          // pre-AM3 specific behavior
          const showPerformanceUnits =
            isAm2Plan(activePlan.id) &&
            organization?.features?.includes('profiling-billing') &&
            category === DataCategory.TRANSACTIONS;

          const categoryInfo = getCategoryInfoFromPlural(category);
          const reserved = currentReserved[category] ?? 0;
          const paygPpe = getPaygPpe({
            activePlan,
            category,
            reserved,
          });
          const hasConstantPpe = activePlan.planCategories[category]?.length === 1;
          const pluralName = getPlanCategoryName({
            plan: activePlan,
            category,
            capitalize: true,
          });
          const singularName =
            categoryInfo?.shortenedUnitName ??
            getSingularCategoryName({
              plan: activePlan,
              category,
              capitalize: false,
            });
          return (
            <SharedSpendLimitPriceTableRow key={category}>
              <Flex gap="xs" align="center" paddingRight="xs">
                <Text bold>{pluralName}</Text>
                {reserved > 0 && (
                  <Text variant="accent">
                    {tct('([formattedReserved] included)', {
                      formattedReserved: formatReservedWithUnits(reserved, category, {
                        isAbbreviated: true,
                      }),
                    })}
                  </Text>
                )}
                {showPerformanceUnits
                  ? renderPerformanceHovercard()
                  : categoryInfo?.checkoutTooltip && (
                      <QuestionTooltip
                        title={categoryInfo.checkoutTooltip}
                        position="top"
                        size="xs"
                      />
                    )}
              </Flex>
              <DashedBorder />
              <Container>
                <Text>
                  {hasConstantPpe ? '' : '*'}
                  {formatPaygPricePerUnit({
                    paygPpe,
                  })}
                </Text>
                <Text variant="muted">/{singularName}</Text>
              </Container>
            </SharedSpendLimitPriceTableRow>
          );
        })}
        {Object.keys(additionalProducts).map(product => {
          const addOnInfo =
            activePlan.addOnCategories[product as unknown as AddOnCategory];
          if (!addOnInfo) {
            return null;
          }
          const categories = addOnInfo.dataCategories;
          const reservedBudgetInfo =
            activePlan.availableReservedBudgetTypes[
              product as unknown as ReservedBudgetCategoryType
            ];
          const reservedBudget = reservedBudgetInfo?.defaultBudget;
          const tooltipText = getProductCheckoutDescription(
            addOnInfo.apiName as unknown as SelectableProduct,
            true,
            displayPrice({cents: reservedBudgetInfo?.defaultBudget ?? 0}),
            true
          );

          return (
            <SharedSpendLimitPriceTableRow key={product}>
              <Flex gap="xs" align="center" paddingRight="xs">
                <Text bold>{capitalize(addOnInfo.productName)}</Text>
                {reservedBudget && (
                  <Text variant="accent">
                    {tct(' ([formattedReserved] included)', {
                      formattedReserved: displayPrice({cents: reservedBudget}),
                    })}
                  </Text>
                )}
                {tooltipText && (
                  <QuestionTooltip title={tooltipText} position="top" size="xs" />
                )}
              </Flex>
              <DashedBorder />
              <Container>
                {categories.map((category, index) => {
                  // TODO(checkout v3): update this for non-budget-categories
                  const paygPpe = getPaygPpe({
                    activePlan,
                    category,
                    reserved: RESERVED_BUDGET_QUOTA,
                  });
                  const categoryInfo = getCategoryInfoFromPlural(category);
                  const singularName =
                    categoryInfo?.shortenedUnitName ??
                    getSingularCategoryName({
                      plan: activePlan,
                      category,
                      capitalize: false,
                    });
                  return (
                    <Fragment key={category}>
                      <Text>
                        {formatPaygPricePerUnit({
                          paygPpe,
                        })}
                      </Text>
                      <Text variant="muted">/{singularName}</Text>
                      {index < categories.length - 1 && <Text>, </Text>}
                    </Fragment>
                  );
                })}
              </Container>
            </SharedSpendLimitPriceTableRow>
          );
        })}
      </Grid>
      <Container>
        <Text variant="muted" size="sm">
          {t('* starting rate')}
        </Text>
      </Container>
    </Flex>
  );
}

function InnerSpendLimitSettings({
  activePlan,
  onDemandBudgets,
  onUpdate,
  currentReserved,
  additionalProducts,
  organization,
}: InnerSpendLimitSettingsProps) {
  const handleUpdate = ({newData}: {newData: PartialSpendLimitUpdate}) => {
    if (onDemandBudgets.budgetMode === OnDemandBudgetMode.PER_CATEGORY) {
      onUpdate({
        onDemandBudgets: {
          ...onDemandBudgets,
          budgets: {
            ...onDemandBudgets.budgets,
            ...newData,
          },
        },
      });
    } else {
      onUpdate({
        onDemandBudgets: {
          ...onDemandBudgets,
          ...newData,
        },
      });
    }
  };

  const formattedBudgetMode = onDemandBudgets.budgetMode.replace('_', '-');

  const getPerCategoryWarning = (productName: string) => {
    return (
      <Flex gap="xs" align="center">
        <IconWarning size="sm" />
        <Text variant="muted" size="sm">
          {tct(
            'Additional [productName] usage is only available with a shared spending limit',
            {productName: toTitleCase(productName, {allowInnerUpperCase: true})}
          )}
        </Text>
      </Flex>
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
    const includedAddOns = Object.values(activePlan.addOnCategories).filter(
      addOnInfo => additionalProducts[addOnInfo.apiName as unknown as SelectableProduct]
    );
    inputs = (
      <Flex direction="column" gap="xl">
        <Container>
          {baseCategories.map((category, index) => {
            const reserved = currentReserved[category] ?? 0;
            const paygPpe = getPaygPpe({
              activePlan,
              category,
              reserved,
            });
            const categoryInfo = getCategoryInfoFromPlural(category);

            const pluralName = getPlanCategoryName({
              plan: activePlan,
              category,
              capitalize: false,
            });
            const singularName =
              categoryInfo?.shortenedUnitName ??
              getSingularCategoryName({
                plan: activePlan,
                category,
                capitalize: false,
              });
            const currentBudget = onDemandBudgets.budgets[category] ?? 0;
            const hasPerCategory = categoryInfo?.hasPerCategory;
            const productName = categoryInfo?.productName ?? pluralName;
            const hasConstantPpe = activePlan.planCategories[category]?.length === 1;
            const isLastInList =
              index === baseCategories.length - 1 && includedAddOns.length === 0;
            const showPerformanceUnits =
              isAm2Plan(activePlan.id) &&
              organization?.features?.includes('profiling-billing') &&
              category === DataCategory.TRANSACTIONS;

            return (
              <Flex
                key={category}
                justify="between"
                align="center"
                gap="lg"
                padding="lg 0"
                borderBottom={isLastInList ? undefined : 'primary'}
              >
                <Flex gap="xs" align="center">
                  <Text bold>{upperFirst(pluralName)}</Text>
                  {showPerformanceUnits
                    ? renderPerformanceHovercard()
                    : categoryInfo?.checkoutTooltip && (
                        <QuestionTooltip
                          title={categoryInfo.checkoutTooltip}
                          position="top"
                          size="xs"
                        />
                      )}
                  <Text variant="muted">
                    {reserved === 0
                      ? t('None included')
                      : tct('[reserved] included', {
                          reserved: formatReservedWithUnits(reserved, category, {
                            isAbbreviated: false,
                            useUnitScaling: true,
                          }),
                        })}
                    {hasPerCategory && (
                      <Fragment>
                        ・
                        {`${hasConstantPpe ? '' : '*'}${formatPaygPricePerUnit({
                          paygPpe,
                        })}`}
                        /{singularName}
                      </Fragment>
                    )}
                  </Text>
                </Flex>
                {hasPerCategory ? (
                  <SpendLimitInput
                    activePlan={activePlan}
                    budgetMode={OnDemandBudgetMode.PER_CATEGORY}
                    category={category}
                    currentSpendingLimit={currentBudget}
                    onUpdate={handleUpdate}
                    reserved={reserved}
                  />
                ) : (
                  getPerCategoryWarning(productName)
                )}
              </Flex>
            );
          })}
          {includedAddOns.map((addOnInfo, index) => {
            // TODO(checkout v3): this will need to be updated for non-budget products
            const checkoutState =
              additionalProducts[addOnInfo.apiName as unknown as SelectableProduct];
            const reserved = checkoutState.reserved
              ? checkoutState.reserved
              : (activePlan.availableReservedBudgetTypes[
                  addOnInfo.apiName as unknown as ReservedBudgetCategoryType
                ]?.defaultBudget ?? 0);
            const reservedType = checkoutState.reservedType ?? 'budget';
            const isLastInList = index === includedAddOns.length - 1;
            const tooltipText = getProductCheckoutDescription(
              addOnInfo.apiName as unknown as SelectableProduct,
              true,
              displayPrice({cents: reserved}),
              true
            );

            return (
              <Flex
                key={addOnInfo.apiName}
                justify="between"
                align="center"
                gap="lg"
                padding="xl 0"
                borderBottom={isLastInList ? undefined : 'primary'}
              >
                <Flex gap="xs" align="center">
                  <Text bold>{upperFirst(addOnInfo.productName)}</Text>
                  {tooltipText && (
                    <QuestionTooltip title={tooltipText} position="top" size="xs" />
                  )}
                  <Text variant="muted">
                    {reserved === 0
                      ? t('None included')
                      : reservedType === 'budget'
                        ? tct('[reservedBudget] credit included', {
                            reservedBudget: displayPrice({cents: reserved}),
                          })
                        : tct('[reserved] [pluralName] included', {
                            reserved,
                            pluralName: addOnInfo.productName,
                          })}
                  </Text>
                </Flex>
                {getPerCategoryWarning(addOnInfo.productName)}
              </Flex>
            );
          })}
        </Container>
        <Container>
          <Text variant="muted" size="sm">
            {t('* starting rate')}
          </Text>
        </Container>
      </Flex>
    );
  } else {
    inputs = (
      <Fragment>
        <Flex direction="column" gap="lg">
          <SpendLimitInput
            activePlan={activePlan}
            budgetMode={OnDemandBudgetMode.SHARED}
            category={null}
            currentSpendingLimit={onDemandBudgets.sharedMaxBudget ?? 0}
            onUpdate={handleUpdate}
            reserved={null}
          />
          <Container width="344px">
            <Text variant="muted" size="sm">
              {t(
                'Charges are applied at the end of your usage cycle, and your limit can be adjusted at anytime.'
              )}
            </Text>
          </Container>
        </Flex>
        <SharedSpendLimitPriceTable
          activePlan={activePlan}
          currentReserved={currentReserved}
          additionalProducts={additionalProducts}
          organization={organization}
        />
      </Fragment>
    );
  }

  return (
    <Flex direction="column" gap="xl">
      <Container>
        <Heading as="h2" size="md">
          {tct('Monthly spending [limitTerm]', {
            budgetMode: formattedBudgetMode,
            limitTerm:
              onDemandBudgets.budgetMode === OnDemandBudgetMode.PER_CATEGORY
                ? 'limits'
                : 'limit',
          })}
        </Heading>
      </Container>
      {inputs}
    </Flex>
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
          <CheckoutOption
            key={budgetMode}
            ariaLabel={`${budgetModeName} spending limit mode`}
            ariaRole="radio"
            dataTestId={`budget-mode-${budgetMode}`}
            isSelected={isSelected}
            onClick={() => {
              onUpdate({
                onDemandBudgets: nextOnDemandBudget,
              });
            }}
          >
            <Flex align="start" gap="md" padding="xl">
              <Container paddingTop="2xs">
                <RadioMarker
                  width="16px"
                  height="16px"
                  border={isSelected ? 'accent' : 'primary'}
                  radius="full"
                  background="primary"
                  isSelected={isSelected}
                />
              </Container>
              <Heading as="h3" variant={isSelected ? 'accent' : 'primary'}>
                {budgetMode === OnDemandBudgetMode.PER_CATEGORY
                  ? t('Set a spending limit for each product')
                  : t('Set a spending limit shared across all products')}
              </Heading>
            </Flex>
          </CheckoutOption>
        );
      })}
    </Grid>
  );
}

function SpendLimitSettings({
  header,
  activePlan,
  onDemandBudgets,
  onUpdate,
  currentReserved,
  isOpen,
  additionalProducts,
  footer,
  organization,
}: SpendLimitSettingsProps) {
  return (
    <Flex direction="column" gap="sm">
      {header}
      {isOpen && (
        <Grid gap="2xl">
          <Text variant="muted">
            {tct(
              "[budgetTerm] lets you go beyond what's included in your plan. It applies across all products on a first-come, first-served basis, and you're only charged for what you use -- if your monthly usage stays within your plan, you won't pay extra.",
              {
                budgetTerm:
                  activePlan.budgetTerm === 'pay-as-you-go'
                    ? `${capitalize(activePlan.budgetTerm)} (PAYG)`
                    : `${capitalize(activePlan.budgetTerm)}`,
              }
            )}
          </Text>
          <BudgetModeSettings
            activePlan={activePlan}
            onDemandBudgets={onDemandBudgets}
            onUpdate={onUpdate}
          />
          <InnerContainer
            direction="column"
            gap="xl"
            padding="xl"
            border="primary"
            radius="md"
            background="primary"
          >
            <InnerSpendLimitSettings
              activePlan={activePlan}
              onDemandBudgets={onDemandBudgets}
              onUpdate={onUpdate}
              currentReserved={currentReserved}
              additionalProducts={additionalProducts}
              organization={organization}
            />
            {footer}
          </InnerContainer>
        </Grid>
      )}
    </Flex>
  );
}

export default SpendLimitSettings;

const RadioMarker = styled(Container)<{isSelected: boolean}>`
  border-width: ${p => (p.isSelected ? '4px' : '1px')};
`;

const InnerContainer = styled(Flex)`
  border-bottom: ${p => (p.theme.isChonk ? '3px' : '1px')} solid ${p => p.theme.border};
`;

const StyledInput = styled(Input)`
  padding-left: ${p => p.theme.space['3xl']};
  width: 344px;
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

const DashedBorder = styled('div')`
  border-top: 1px dashed ${p => p.theme.border};
  height: 1px;
`;
