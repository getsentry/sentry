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

export function getProductCheckoutDescription({
  product,
  withPunctuation,
}: {
  product: AddOnCategory;
  withPunctuation: boolean;
  includedBudget?: string;
}) {
  if (product === AddOnCategory.LEGACY_SEER) {
    return tct('Detect and fix issues faster with our AI agent[punctuation]', {
      punctuation: withPunctuation ? '.' : '',
    });
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
      // if the add-on is not available, don't show it
      subscription.addOns?.[addOnInfo.apiName]?.isAvailable ?? false
  );

  const theme = useTheme();
  const billingInterval = utils.getShortInterval(activePlan.billingInterval);

  return (
    <Fragment>
      {availableAddOns.map(addOnInfo => {
        const {productName, apiName} = addOnInfo;

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

        if (apiName === AddOnCategory.LEGACY_SEER) {
          const SUBCATEGORY_TEXT = {
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
          };
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
                  <IconSeer animation="waiting" size="lg" />
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
                            variant="promotion"
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
                      {Object.entries(SUBCATEGORY_TEXT).map(([category, info]) => {
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
        }

        if (apiName === AddOnCategory.SEER) {
          return (
            <Flex direction="column" gap="xl" key={apiName}>
              <Flex gap="sm" align="center">
                <Badge variant="new">{t('New')}</Badge>
                <Heading as="h2">
                  {t('Find and fix issues anywhere with Seer AI debugger')}
                </Heading>
              </Flex>
              {!isSelected && subscription.addOns?.[AddOnCategory.SEER]?.enabled && (
                <Alert variant="warning" icon={<IconWarning />}>
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

                    <Flex align="center" justify="between" gap="sm" flex="1" wrap="wrap">
                      <Heading as="h3" variant="primary">
                        {toTitleCase(productName, {
                          allowInnerUpperCase: true,
                        })}
                      </Heading>
                      <Flex align="start" gap="xs" wrap="wrap">
                        {/* TODO(seer): serialize pricing info */}
                        <Text size="lg" bold variant="primary">
                          +$40
                        </Text>
                        <Text size="lg" variant="muted">
                          {t('/ active contributor / month')}
                        </Text>
                      </Flex>
                    </Flex>
                  </Flex>
                  <Flex direction="column" gap="2xs">
                    <Separator orientation="horizontal" border="primary" />
                    <Flex
                      direction="column"
                      gap="lg"
                      paddingTop="xl"
                      data-test-id="product-option-description"
                    >
                      <Text variant="muted">
                        {t(
                          'An active contributor is anyone who opens 2 or more PRs in a connected GitHub repository. Count resets each month.'
                        )}
                      </Text>
                      <Flex direction="column" gap="xs">
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
                </Flex>
              </CheckoutOption>
            </Flex>
          );
        }
        return null;
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
  color: ${p => p.theme.tokens.content.primary};
  gap: ${p => p.theme.space.md};
`;
