import type React from 'react';
import {Fragment} from 'react';
import upperFirst from 'lodash/upperFirst';

import {InfoTip} from '@sentry/scraps/info';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {IconWarning} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';

import {
  OnDemandBudgetMode,
  type AddOnCategory,
  type OnDemandBudgets,
  type Plan,
  type Subscription,
} from 'getsentry/types';
import {
  displayBudgetName,
  formatReservedWithUnits,
  getReservedBudgetCategoryForAddOn,
} from 'getsentry/utils/billing';
import {
  getCategoryInfoFromPlural,
  getPlanCategoryName,
  getSingularCategoryName,
} from 'getsentry/utils/dataCategory';
import {renderPerformanceHovercard} from 'getsentry/views/amCheckout/components/volumeSliders';
import {getProductCheckoutDescription} from 'getsentry/views/amCheckout/steps/productSelect';
import {displayPrice} from 'getsentry/views/amCheckout/utils';
import {
  BudgetModeSettings,
  type BudgetModeSettingsProps,
} from 'getsentry/views/spendLimits/budgetModeSettings';
import {
  formatPaygPricePerUnit,
  getPaygPpe,
} from 'getsentry/views/spendLimits/pricingUtils';
import {SharedSpendLimitPriceTable} from 'getsentry/views/spendLimits/sharedSpendLimitPriceTable';
import {
  SpendLimitInput,
  type PartialSpendLimitUpdate,
  type SpendLimitInputProps,
} from 'getsentry/views/spendLimits/spendLimitInput';

const LARGE_INPUT_WIDTH = '300px';

export interface SpendLimitSettingsProps {
  activePlan: Plan;
  addOns: Partial<Record<AddOnCategory, {enabled: boolean}>>;
  currentReserved: Partial<Record<DataCategory, number>>;
  header: React.ReactNode;
  onDemandBudgets: OnDemandBudgets;
  onUpdate: ({onDemandBudgets}: {onDemandBudgets: OnDemandBudgets}) => void;
  organization: Organization;
  subscription: Subscription;
  footer?: React.ReactNode;
  renderBudgetModeSettings?: (props: BudgetModeSettingsProps) => React.ReactNode;
  renderSpendLimitInput?: (props: SpendLimitInputProps) => React.ReactNode;
  usesFormFieldLayout?: boolean;
}

interface InnerSpendLimitSettingsProps extends Omit<
  SpendLimitSettingsProps,
  'header' | 'subscription'
> {}

function InnerSpendLimitSettings({
  activePlan,
  onDemandBudgets,
  onUpdate,
  currentReserved,
  addOns,
  organization,
  renderSpendLimitInput,
  usesFormFieldLayout,
}: InnerSpendLimitSettingsProps) {
  const includedAddOns = Object.entries(addOns)
    .filter(([apiName, addOn]) => {
      const addOnInfo = activePlan.addOnCategories[apiName as AddOnCategory];
      return (
        addOnInfo &&
        addOn.enabled &&
        addOnInfo.dataCategories.some(category =>
          activePlan.onDemandCategories.includes(category)
        )
      );
    })
    .map(([apiName]) => apiName) as AddOnCategory[];

  function handleUpdate({newData}: {newData: PartialSpendLimitUpdate}) {
    if (onDemandBudgets.budgetMode === OnDemandBudgetMode.PER_CATEGORY) {
      onUpdate({
        onDemandBudgets: {
          ...onDemandBudgets,
          budgets: {...onDemandBudgets.budgets, ...newData},
        },
      });
      return;
    }
    onUpdate({onDemandBudgets: {...onDemandBudgets, ...newData}});
  }

  function renderPerCategoryWarning(productName: string) {
    return (
      <Flex gap="xs" height="36px" align="center">
        <Container flexShrink={0}>
          <IconWarning size="sm" />
        </Container>
        <Text variant="muted" size="sm">
          {tct(
            'Additional [productName] usage is only available with a shared spending limit',
            {productName: toTitleCase(productName, {allowInnerUpperCase: true})}
          )}
        </Text>
      </Flex>
    );
  }

  const renderInput = renderSpendLimitInput ?? (props => <SpendLimitInput {...props} />);
  let inputs: React.ReactNode;

  if (onDemandBudgets.budgetMode === OnDemandBudgetMode.PER_CATEGORY) {
    const addOnCategories = Object.values(activePlan.addOnCategories).flatMap(
      addOnInfo => addOnInfo.dataCategories
    );
    const baseCategories = activePlan.onDemandCategories.filter(
      category => !addOnCategories.includes(category)
    );

    inputs = (
      <Stack gap="xl" padding="0 xl xl">
        <Container>
          {baseCategories.map((category, index) => {
            const reserved = currentReserved[category] ?? 0;
            const paygPpe = getPaygPpe({activePlan, category, reserved});
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
              activePlan.categories.includes(DataCategory.TRANSACTIONS) &&
              activePlan.categories.includes(DataCategory.PROFILE_DURATION) &&
              organization.features?.includes('profiling-billing') &&
              category === DataCategory.TRANSACTIONS;

            return (
              <Grid
                key={category}
                columns={{
                  zero: 'minmax(0, 1fr)',
                  lg: 'minmax(0, 3fr) minmax(0, 2fr)',
                }}
                align={{zero: 'start', lg: 'center'}}
                gap={{zero: 'xs', lg: 'lg'}}
                padding={index === 0 ? '0 0 lg' : 'lg 0'}
                borderBottom={isLastInList ? undefined : 'primary'}
              >
                <Stack gap="xs" align="start" flexGrow={1}>
                  <Flex align="center" gap="xs">
                    <Text bold>{upperFirst(pluralName)}</Text>
                    {showPerformanceUnits ? (
                      <Container flexShrink={0}>{renderPerformanceHovercard()}</Container>
                    ) : categoryInfo?.checkoutTooltip ? (
                      <Container flexShrink={0}>
                        <InfoTip
                          title={categoryInfo.checkoutTooltip}
                          position="top"
                          size="xs"
                        />
                      </Container>
                    ) : null}
                  </Flex>
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
                        {`${hasConstantPpe ? '' : '*'}${formatPaygPricePerUnit({paygPpe})}`}
                        /{singularName}
                      </Fragment>
                    )}
                  </Text>
                </Stack>
                {hasPerCategory
                  ? renderInput({
                      activePlan,
                      budgetMode: OnDemandBudgetMode.PER_CATEGORY,
                      category,
                      currentSpendingLimit: currentBudget,
                      onUpdate: handleUpdate,
                      reserved,
                    })
                  : renderPerCategoryWarning(productName)}
              </Grid>
            );
          })}
          {includedAddOns.map((apiName, index) => {
            const addOnInfo = activePlan.addOnCategories[apiName]!;
            const reservedBudgetCategory = getReservedBudgetCategoryForAddOn(apiName);
            const includedBudget = reservedBudgetCategory
              ? (activePlan.availableReservedBudgetTypes[reservedBudgetCategory]
                  ?.defaultBudget ?? 0)
              : 0;
            const tooltipText = getProductCheckoutDescription({
              product: apiName,
              withPunctuation: true,
            });

            return (
              <Grid
                key={apiName}
                columns={{
                  zero: 'minmax(0, 1fr)',
                  lg: 'minmax(0, 3fr) minmax(0, 2fr)',
                }}
                align={{zero: 'start', lg: 'center'}}
                gap={{zero: 'xs', lg: 'lg'}}
                padding={index === 0 && baseCategories.length === 0 ? '0 0 xl' : 'xl 0'}
                borderBottom={index === includedAddOns.length - 1 ? undefined : 'primary'}
              >
                <Stack gap="xs" align="start" flexGrow={1}>
                  <Flex align="center" gap="xs">
                    <Text bold>{upperFirst(addOnInfo.productName)}</Text>
                    {tooltipText && (
                      <Container flexShrink={0}>
                        <InfoTip title={tooltipText} position="top" size="xs" />
                      </Container>
                    )}
                  </Flex>
                  <Text variant="muted">
                    {includedBudget
                      ? tct('[reservedBudget] credit included', {
                          reservedBudget: displayPrice({cents: includedBudget}),
                        })
                      : t('None included')}
                  </Text>
                </Stack>
                {renderPerCategoryWarning(addOnInfo.productName)}
              </Grid>
            );
          })}
        </Container>
        <Flex justify="end">
          <Text variant="muted" size="sm">
            {t('* starting rate')}
          </Text>
        </Flex>
      </Stack>
    );
  } else {
    inputs = (
      <Fragment>
        <Stack gap="lg" padding="0 xl sm">
          {renderInput({
            activePlan,
            budgetMode: OnDemandBudgetMode.SHARED,
            category: null,
            currentSpendingLimit: onDemandBudgets.sharedMaxBudget ?? 0,
            onUpdate: handleUpdate,
            reserved: null,
          })}
          {!usesFormFieldLayout && (
            <Container width={{zero: '100%', xl: LARGE_INPUT_WIDTH}}>
              <Text variant="muted" size="sm">
                {t(
                  'Charges are applied at the end of your usage cycle, and your limit can be adjusted at anytime.'
                )}
              </Text>
            </Container>
          )}
        </Stack>
        <SharedSpendLimitPriceTable
          activePlan={activePlan}
          currentReserved={currentReserved}
          organization={organization}
          includedAddOns={includedAddOns}
        />
      </Fragment>
    );
  }

  return (
    <Stack gap="lg">
      {(!usesFormFieldLayout ||
        onDemandBudgets.budgetMode === OnDemandBudgetMode.PER_CATEGORY) && (
        <Container padding="xl xl 0">
          <Heading as="h2" size="lg">
            {tct('Monthly spending [limitTerm]', {
              budgetMode: onDemandBudgets.budgetMode.replace('_', '-'),
              limitTerm:
                onDemandBudgets.budgetMode === OnDemandBudgetMode.PER_CATEGORY
                  ? 'limits'
                  : 'limit',
            })}
          </Heading>
        </Container>
      )}
      {inputs}
    </Stack>
  );
}

export function SpendLimitSettings({
  header,
  activePlan,
  onDemandBudgets,
  onUpdate,
  currentReserved,
  addOns,
  footer,
  organization,
  subscription,
  renderBudgetModeSettings,
  renderSpendLimitInput,
  usesFormFieldLayout,
}: SpendLimitSettingsProps) {
  const budgetModeSettingsProps = {activePlan, onDemandBudgets, onUpdate};
  return (
    <Stack gap="sm">
      {header}
      <Grid gap="2xl">
        <Text variant="muted">
          {tct(
            "[budgetTerm] lets you go beyond what's included in your plan. It applies across all products on a first-come, first-served basis, and you're only charged for what you use -- if your monthly usage stays within your plan, you won't pay extra.[partnerMessage]",
            {
              budgetTerm:
                activePlan.budgetTerm === 'pay-as-you-go'
                  ? `${displayBudgetName(activePlan, {title: true})} (PAYG)`
                  : displayBudgetName(activePlan, {title: true}),
              partnerMessage: subscription.isSelfServePartner
                ? tct(' This will be part of your [partnerName] bill.', {
                    partnerName: subscription.partner?.partnership.displayName,
                  })
                : '',
            }
          )}
        </Text>
        {renderBudgetModeSettings ? (
          renderBudgetModeSettings(budgetModeSettingsProps)
        ) : (
          <BudgetModeSettings {...budgetModeSettingsProps} />
        )}
        <Stack gap="xl" border="primary" radius="md" overflow="hidden">
          <InnerSpendLimitSettings
            activePlan={activePlan}
            onDemandBudgets={onDemandBudgets}
            onUpdate={onUpdate}
            currentReserved={currentReserved}
            addOns={addOns}
            organization={organization}
            renderSpendLimitInput={renderSpendLimitInput}
            usesFormFieldLayout={usesFormFieldLayout}
          />
          {footer}
        </Stack>
      </Grid>
    </Stack>
  );
}
