import {Fragment} from 'react';
import styled from '@emotion/styled';
import {IconCheckmark} from '@sentry/icons/checkmark';
import {IconSeer} from '@sentry/icons/seer';
import {IconWarning} from '@sentry/icons/warning';

import {Alert} from '@sentry/scraps/alert';
import {Badge, Tag} from '@sentry/scraps/badge';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Separator} from '@sentry/scraps/separator';
import {Heading, Text} from '@sentry/scraps/text';
import {ToggleCard} from '@sentry/scraps/toggleCard';

import {t, tct} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';
import {useOrganization} from 'sentry/utils/useOrganization';

import {AddOnCategory} from 'getsentry/types';
import {
  displayUnitPrice,
  formatPrice,
  getReservedBudgetCategoryForAddOn,
} from 'getsentry/utils/billing';
import {
  getCategoryInfoFromPlural,
  getSingularCategoryName,
} from 'getsentry/utils/dataCategory';
import {formatCurrency} from 'getsentry/utils/formatCurrency';
import {type StepProps} from 'getsentry/views/amCheckout/types';
import * as utils from 'getsentry/views/amCheckout/utils';

export function getProductCheckoutDescription({
  product,
  withPunctuation,
}: {
  product: AddOnCategory;
  withPunctuation: boolean;
}) {
  if (product === AddOnCategory.LEGACY_SEER) {
    return tct('Detect and fix issues faster with our AI agent[punctuation]', {
      punctuation: withPunctuation ? '.' : '',
    });
  }
  return '';
}

export function ProductSelect({
  activePlan,
  formData,
  onUpdate,
  subscription,
}: Pick<StepProps, 'activePlan' | 'onUpdate' | 'formData' | 'subscription'>) {
  const organization = useOrganization();

  const availableAddOns = Object.values(activePlan.addOnCategories).filter(
    addOnInfo =>
      // if the add-on is not available, don't show it
      subscription.addOns?.[addOnInfo.apiName]?.isAvailable ?? false
  );

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

        const priceInDollars = formatPrice({
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
            <Stack gap="xl" key={apiName}>
              <ToggleCard
                variant="checkbox"
                aria-label={ariaLabel}
                data-test-id={`product-option-${apiName}`}
                value={apiName}
                onChange={toggleProductOption}
                checked={!!isSelected}
              >
                <Stack gap="lg">
                  <Flex align="center" gap="lg">
                    <IconSeer animation="idle" size="lg" />
                    <Heading as="h2">
                      {t('Detect and fix issues faster with our AI agent')}
                    </Heading>
                  </Flex>
                  <Flex align="start" gap="md">
                    <ToggleCard.Indicator />
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
                  <Separator orientation="horizontal" border="primary" />
                  <Stack gap="xl" paddingTop="xl">
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
                          <Flex align="center" marginTop="2xs">
                            <IconCheckmark variant="success" />
                          </Flex>
                          <Stack gap="xs">
                            <Text size="md">
                              {getSingularCategoryName({
                                plan: activePlan,
                                category: category as DataCategory,
                              })}
                              {' - '}
                              {eventPrice &&
                                `${displayUnitPrice({cents: eventPrice, minDigits: 0, maxDigits: info.maxEventPriceDigits})}/${perEventNameOverride}`}
                            </Text>
                            <Text size="md" variant="muted">
                              {info.description}
                            </Text>
                          </Stack>
                        </FeatureItem>
                      );
                    })}
                  </Stack>
                </Stack>
              </ToggleCard>
            </Stack>
          );
        }

        if (apiName === AddOnCategory.SEER) {
          const hasGitLabSupport = organization.features.includes('seer-gitlab-support');
          return (
            <Stack gap="xl" key={apiName}>
              <Flex gap="sm" align="start">
                <Badge variant="new">{t('New')}</Badge>
                <Heading as="h2" textWrap="pretty">
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
              <ToggleCard
                variant="checkbox"
                aria-label={ariaLabel}
                data-test-id={`product-option-${apiName}`}
                value={apiName}
                onChange={toggleProductOption}
                checked={!!isSelected}
              >
                <Stack gap="lg">
                  <Flex align="start" gap="md">
                    <ToggleCard.Indicator />
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
                  <Separator orientation="horizontal" border="primary" />
                  <Stack gap="lg" data-test-id="product-option-description">
                    <Text variant="muted">
                      {hasGitLabSupport
                        ? t(
                            'An active contributor is anyone who opens 2 or more PRs in a connected GitHub or GitLab repository. Count resets each month.'
                          )
                        : t(
                            'An active contributor is anyone who opens 2 or more PRs in a connected GitHub repository. Count resets each month.'
                          )}
                    </Text>
                    <Stack gap="xs">
                      <Text variant="muted">
                        {t(
                          'Setup required: connect repositories after adding to your plan.'
                        )}
                      </Text>
                      <Text variant="muted">
                        {t('Billed at month-end and varies with active contributors.')}
                      </Text>
                    </Stack>
                  </Stack>
                </Stack>
              </ToggleCard>
            </Stack>
          );
        }
        return null;
      })}
    </Fragment>
  );
}

const FeatureItem = styled('div')`
  font-size: ${p => p.theme.font.size.sm};
  display: grid;
  grid-template-columns: ${p => p.theme.space.xl} 1fr;
  align-items: start;
  color: ${p => p.theme.tokens.content.primary};
  gap: ${p => p.theme.space.md};
`;
