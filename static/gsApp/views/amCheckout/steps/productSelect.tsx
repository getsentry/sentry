import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Alert} from '@sentry/scraps/alert';
import {Badge} from '@sentry/scraps/badge';

import {Tag} from 'sentry/components/core/badge/tag';
import {Checkbox} from 'sentry/components/core/checkbox';
import {Flex} from 'sentry/components/core/layout';
import {Separator} from 'sentry/components/core/separator';
import {Heading, Text} from 'sentry/components/core/text';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {IconCheckmark, IconSeer, IconWarning} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';
import type {Color} from 'sentry/utils/theme';

import {AddOnCategory} from 'getsentry/types';
import {getReservedBudgetCategoryForAddOn} from 'getsentry/utils/billing';
import {
  getCategoryInfoFromPlural,
  getSingularCategoryName,
} from 'getsentry/utils/dataCategory';
import formatCurrency from 'getsentry/utils/formatCurrency';
import CheckoutOption from 'getsentry/views/amCheckout/components/checkoutOption';
import {type StepProps} from 'getsentry/views/amCheckout/types';
import * as utils from 'getsentry/views/amCheckout/utils';

interface ProductCheckoutInfo {
  categoryInfo: Partial<
    Record<
      DataCategory,
      {
        description: string;
        maxEventPriceDigits: number;
      }
    >
  >;
}

export function getProductCheckoutDescription({
  product,
  isNewCheckout,
  withPunctuation,
  includedBudget,
}: {
  isNewCheckout: boolean;
  product: AddOnCategory;
  withPunctuation: boolean;
  includedBudget?: string;
}) {
  if (product === AddOnCategory.LEGACY_SEER) {
    if (isNewCheckout) {
      return tct('Detect and fix issues faster with our AI agent[punctuation]', {
        punctuation: withPunctuation ? '.' : '',
      });
    }
    return tct(
      'Detect and fix issues faster with [budgetText]our AI agent[punctuation]',
      {
        budgetText: includedBudget
          ? tct('[includedBudget]/mo in credits towards ', {
              includedBudget,
            })
          : '',
        punctuation: withPunctuation ? '.' : '',
      }
    );
  }

  if (product === AddOnCategory.SEER) {
    return (
      <Flex direction="column" gap="sm">
        <Text>
          {t('Setup required: connect repositories after adding to your plan.')}
        </Text>
        <Text>{t('Billed at month-end and varies with active contributors.')}</Text>
      </Flex>
    );
  }

  return '';
}

function ProductSelect({
  activePlan,
  formData,
  onUpdate,
  subscription,
}: Pick<StepProps, 'activePlan' | 'onUpdate' | 'formData' | 'subscription'>) {
  const availableAddOns = Object.values(activePlan.addOnCategories).filter(
    addOnInfo =>
      // if there's no billing flag, we assume it's launched
      (!addOnInfo.billingFlag || activePlan.features.includes(addOnInfo.billingFlag)) &&
      // do not show Seer if the legacy Seer add-on is enabled
      (addOnInfo.apiName !== AddOnCategory.SEER ||
        !subscription.addOns?.[AddOnCategory.LEGACY_SEER]?.enabled) &&
      // do not show legacy Seer if Seer is launched
      (addOnInfo.apiName !== AddOnCategory.LEGACY_SEER ||
        !activePlan.features.includes(
          activePlan.addOnCategories[AddOnCategory.SEER]?.billingFlag ?? ''
        ))
  );

  const theme = useTheme();
  const PRODUCT_CHECKOUT_INFO = {
    [AddOnCategory.LEGACY_SEER]: {
      categoryInfo: {
        [DataCategory.SEER_AUTOFIX]: {
          description: t(
            'Uses the latest AI models with Sentry data to find root causes & proposes PRs'
          ),
          maxEventPriceDigits: 0,
        },
        [DataCategory.SEER_SCANNER]: {
          description: t(
            'Triages issues as they happen, automatically flagging highly-fixable ones for followup'
          ),
          maxEventPriceDigits: 3,
        },
      },
    },
    [AddOnCategory.SEER]: {
      categoryInfo: {},
    },
  } satisfies Record<AddOnCategory, ProductCheckoutInfo>;
  const billingInterval = utils.getShortInterval(activePlan.billingInterval);

  return (
    <Fragment>
      {availableAddOns.map(addOnInfo => {
        const {productName, apiName} = addOnInfo;
        const checkoutInfo = PRODUCT_CHECKOUT_INFO[apiName];
        if (!checkoutInfo) {
          return null;
        }

        // how much the customer is paying for the product
        const priceInCents = utils.getPrepaidPriceForAddOn({
          plan: activePlan,
          addOnCategory: apiName,
        });

        const priceInDollars = utils.formatPrice({
          cents: priceInCents,
        });

        const reservedBudgetCategory = getReservedBudgetCategoryForAddOn(apiName);
        let reservedBudgetInfo = null;
        if (reservedBudgetCategory) {
          reservedBudgetInfo =
            activePlan.availableReservedBudgetTypes[reservedBudgetCategory];
        }

        // how much the customer gets per month for the product
        // if no default budget, then the included budget is how much the customer is paying for the product
        const formattedMonthlyBudget = reservedBudgetInfo
          ? formatCurrency(reservedBudgetInfo.defaultBudget ?? priceInCents)
          : null;

        const isSelected = formData.addOns?.[apiName]?.enabled ?? false;

        const ariaLabel = t('Add %s to plan', productName);

        const toggleProductOption = () => {
          onUpdate({
            addOns: {
              ...formData.addOns,
              [apiName]: {
                enabled: !isSelected,
              },
            },
          });
        };

        if (apiName === AddOnCategory.SEER) {
          return (
            <Flex direction="column" gap="xl" key={apiName}>
              <Flex gap="sm" align="center">
                <Badge type="new">{t('New')}</Badge>
                <Heading as="h2">
                  {t('Find and fix issues anywhere with Seer AI debugger')}
                </Heading>
              </Flex>
              {!isSelected && subscription.addOns?.[AddOnCategory.SEER]?.enabled && (
                <Alert type="warning" icon={<IconWarning />}>
                  {t(
                    'Billing continues through the current cycle. New contributors and repos won’t get code reviews after cancellation.'
                  )}
                </Alert>
              )}
              <CheckoutOption
                ariaLabel={ariaLabel}
                dataTestId={`product-option-${apiName}`}
                onClick={toggleProductOption}
                isSelected={!!isSelected}
                ariaRole="checkbox"
              >
                <Flex direction="column" gap="lg" padding="xl" width="100%">
                  <Flex align="center" gap="md">
                    <Checkbox
                      tabIndex={-1} // let CheckoutOption handle the focus
                      aria-label={ariaLabel}
                      aria-checked={isSelected}
                      checked={isSelected}
                      onChange={toggleProductOption}
                    />

                    <Flex align="center" justify="between" gap="sm" flex="1">
                      <Heading as="h3" variant="primary">
                        {toTitleCase(productName, {
                          allowInnerUpperCase: true,
                        })}
                      </Heading>
                      <Flex align="center" gap="xs">
                        <Text size="lg" bold variant="primary">
                          +$40
                        </Text>
                        <Text size="lg" variant="muted">
                          {t('/ active contributor / month')}
                        </Text>
                        <QuestionTooltip title={t('Tooltip copy TBD')} size="sm" />
                      </Flex>
                    </Flex>
                  </Flex>
                  <Flex direction="column" gap="2xs">
                    <Separator orientation="horizontal" border="primary" />
                    <Flex direction="column" gap="sm" paddingTop="xl">
                      <Text variant="muted">
                        {t(
                          'Setup required: connect repositories after adding to your plan.'
                        )}
                      </Text>
                      <Text variant="muted">
                        {t('Billed at month-end and varies with active contributors.')}
                      </Text>
                    </Flex>
                  </Flex>
                </Flex>
              </CheckoutOption>
            </Flex>
          );
        }

        return (
          <Flex direction="column" gap="xl" key={apiName}>
            <CheckoutOption
              ariaLabel={ariaLabel}
              dataTestId={`product-option-${apiName}`}
              onClick={toggleProductOption}
              isSelected={!!isSelected}
              ariaRole="checkbox"
            >
              <Flex align="center" gap="lg" padding="xl">
                <IconSeer variant="waiting" size="lg" />
                <Heading as="h2">
                  {t('Detect and fix issues faster with our AI agent')}
                </Heading>
              </Flex>
              <Flex direction="column" gap="lg" padding="xl" width="100%">
                <Flex align="center" gap="md">
                  <Checkbox
                    tabIndex={-1} // let CheckoutOption handle the focus
                    aria-label={ariaLabel}
                    aria-checked={isSelected}
                    checked={isSelected}
                    onChange={toggleProductOption}
                  />

                  <Flex align="center" justify="between" gap="sm" flex="1">
                    <Heading as="h3" variant="primary">
                      {toTitleCase(productName, {
                        allowInnerUpperCase: true,
                      })}
                    </Heading>
                    <Flex align="center" gap="md">
                      {formattedMonthlyBudget && (
                        <Tag
                          type="promotion"
                          data-test-id="product-option-feature-credits"
                        >
                          {tct('Includes [includedBudget]/mo in credits', {
                            includedBudget: formattedMonthlyBudget,
                          })}
                        </Tag>
                      )}
                      <Flex>
                        <Text
                          size="lg"
                          bold
                          variant="primary"
                        >{`+$${priceInDollars}`}</Text>
                        <Text size="lg" variant="muted">{`/${billingInterval}`}</Text>
                      </Flex>
                    </Flex>
                  </Flex>
                </Flex>
                <Flex direction="column" gap="2xs">
                  <Separator orientation="horizontal" border="primary" />
                  <Flex direction="column" gap="xl" paddingTop="xl">
                    {Object.entries(checkoutInfo.categoryInfo).map(([category, info]) => {
                      const pricingInfo =
                        activePlan.planCategories[category as DataCategory];
                      const eventPrice = pricingInfo
                        ? pricingInfo[1]?.onDemandPrice
                        : null;
                      const dataCategoryInfo = getCategoryInfoFromPlural(
                        category as DataCategory
                      );
                      const perEventNameOverride =
                        dataCategoryInfo?.shortenedUnitName ??
                        getSingularCategoryName({
                          plan: activePlan,
                          category: category as DataCategory,
                          capitalize: false,
                        });
                      return (
                        <FeatureItem
                          key={category}
                          data-test-id={`product-option-feature-${category}`}
                        >
                          <IconContainer>
                            <IconCheckmark color={theme.successText as Color} />
                          </IconContainer>
                          <Flex direction="column" gap="xs">
                            <Text size="md">
                              {getSingularCategoryName({
                                plan: activePlan,
                                category: category as DataCategory,
                                hadCustomDynamicSampling: false,
                              })}
                              {' - '}
                              {eventPrice &&
                                `${utils.displayUnitPrice({cents: eventPrice, minDigits: 0, maxDigits: info.maxEventPriceDigits})}/${perEventNameOverride}`}
                            </Text>
                            <Text size="md" variant="muted">
                              {info.description}
                            </Text>
                          </Flex>
                        </FeatureItem>
                      );
                    })}
                  </Flex>
                </Flex>
              </Flex>
            </CheckoutOption>
          </Flex>
        );
      })}
    </Fragment>
  );
}

export default ProductSelect;

const IconContainer = styled('div')`
  margin-top: ${p => p.theme.space['2xs']};
  display: flex;
  align-items: center;
`;

const FeatureItem = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  display: grid;
  grid-template-columns: ${p => p.theme.space.xl} 1fr;
  align-items: start;
  color: ${p => p.theme.textColor};
  gap: ${p => p.theme.space.md};
`;
