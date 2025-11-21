import {Fragment} from 'react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import largeStarDark from 'sentry-images/spot/product-select-star-l-dark.svg';
import largeStarLight from 'sentry-images/spot/product-select-star-l.svg';
import mediumStarDark from 'sentry-images/spot/product-select-star-m-dark.svg';
import mediumStarLight from 'sentry-images/spot/product-select-star-m.svg';
import smallStarDark from 'sentry-images/spot/product-select-star-s-dark.svg';
import smallStarLight from 'sentry-images/spot/product-select-star-s.svg';

import {Tag} from 'sentry/components/core/badge/tag';
import {Button} from 'sentry/components/core/button';
import {Checkbox} from 'sentry/components/core/checkbox';
import {Flex} from 'sentry/components/core/layout';
import {Separator} from 'sentry/components/core/separator';
import {Heading, Text} from 'sentry/components/core/text';
import PanelItem from 'sentry/components/panels/panelItem';
import {IconAdd, IconCheckmark} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {DataCategory} from 'sentry/types/core';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';
import type {Color} from 'sentry/utils/theme';

import {AddOnCategory} from 'getsentry/types';
import {getProductIcon, getReservedBudgetCategoryForAddOn} from 'getsentry/utils/billing';
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
  buttonBorderColor?: Color;
  color?: Color;
  gradientEndColor?: Color;
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
  isNewCheckout,
}: Pick<StepProps, 'activePlan' | 'onUpdate' | 'formData' | 'isNewCheckout'>) {
  const availableAddOns = Object.values(activePlan.addOnCategories).filter(
    addOnInfo =>
      // if there's no billing flag, we assume it's launched
      !addOnInfo.billingFlag || activePlan.features.includes(addOnInfo.billingFlag)
  );

  const theme = useTheme();
  const PRODUCT_CHECKOUT_INFO = {
    [AddOnCategory.LEGACY_SEER]: {
      color: theme.pink400 as Color,
      gradientEndColor: theme.pink100 as Color,
      buttonBorderColor: theme.pink200 as Color,
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
      // TODO(isabella): These can be removed once the legacy implementation for this component is removed
      gradientEndColor: undefined,
      buttonBorderColor: undefined,
      color: undefined,
    },
  } satisfies Record<AddOnCategory, ProductCheckoutInfo>;
  const billingInterval = utils.getShortInterval(activePlan.billingInterval);
  const prefersDarkMode = useLegacyStore(ConfigStore).theme === 'dark';

  return (
    <Fragment>
      {!isNewCheckout && <Separator orientation="horizontal" />}
      {availableAddOns.map(addOnInfo => {
        const {productName, apiName} = addOnInfo;
        const checkoutInfo = PRODUCT_CHECKOUT_INFO[apiName];
        if (!checkoutInfo) {
          return null;
        }

        const productIcon = getProductIcon(apiName, 'md');

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

        if (isNewCheckout) {
          return (
            <CheckoutOption
              key={apiName}
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
          );
        }

        return (
          <ProductOption
            key={apiName}
            aria-label={isSelected ? t('Remove ') + productName : t('Add ') + productName}
            data-test-id={`product-option-${apiName}`}
            onClick={toggleProductOption}
          >
            <AnimatedProductOptionContent
              gradientColor={checkoutInfo.gradientEndColor}
              buttonBorderColor={checkoutInfo.buttonBorderColor}
              isSelected={isSelected}
              prefersDarkMode={prefersDarkMode}
            >
              <Row>
                <Column>
                  <ProductLabel productColor={checkoutInfo.color}>
                    {productIcon}
                    <ProductName>
                      {toTitleCase(productName, {
                        allowInnerUpperCase: true,
                      })}
                    </ProductName>
                  </ProductLabel>
                  <ProductDescription>
                    {getProductCheckoutDescription({
                      product: apiName,
                      isNewCheckout: !!isNewCheckout,
                      withPunctuation: false,
                      includedBudget: formattedMonthlyBudget ?? '',
                    })}
                  </ProductDescription>
                </Column>
                <PriceContainer>
                  <PriceHeader>{t('Starts At')}</PriceHeader>
                  <Price>
                    <Currency>$</Currency>
                    <Amount>{priceInDollars}</Amount>
                    <BillingInterval>{`/${billingInterval}`}</BillingInterval>
                  </Price>
                </PriceContainer>
              </Row>
              <Features>
                {Object.entries(checkoutInfo.categoryInfo).map(([category, info]) => {
                  const pricingInfo = activePlan.planCategories[category as DataCategory];
                  const eventPrice = pricingInfo ? pricingInfo[1]?.onDemandPrice : null;
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
                    <Feature
                      key={category}
                      data-test-id={`product-option-feature-${category}`}
                    >
                      <FeatureHeader>
                        <IconContainer>
                          <IconCheckmark color={checkoutInfo.color} />
                        </IconContainer>
                        <span>
                          {getSingularCategoryName({
                            plan: activePlan,
                            category: category as DataCategory,
                            hadCustomDynamicSampling: false,
                            title: true,
                          })}
                        </span>
                        {eventPrice && (
                          <EventPriceTag>{`${utils.displayUnitPrice({cents: eventPrice, minDigits: 0, maxDigits: info.maxEventPriceDigits})} / ${perEventNameOverride}`}</EventPriceTag>
                        )}
                      </FeatureHeader>
                      <FeatureDescription>{info.description}</FeatureDescription>
                    </Feature>
                  );
                })}
              </Features>
              <Row>
                <StyledButton>
                  <ButtonContent
                    color={
                      formData.addOns?.[apiName]?.enabled &&
                      !prefersDarkMode &&
                      checkoutInfo.color
                        ? checkoutInfo.color
                        : theme.textColor
                    }
                  >
                    {formData.addOns?.[apiName]?.enabled ? (
                      <Fragment>
                        <IconCheckmark /> {t('Added to plan')}
                      </Fragment>
                    ) : (
                      <Fragment>
                        <IconAdd />
                        {t('Add to plan')}
                      </Fragment>
                    )}
                  </ButtonContent>
                </StyledButton>
              </Row>
              <IllustrationContainer>
                <Star1 src={prefersDarkMode ? largeStarDark : largeStarLight} />
                <Star2 src={prefersDarkMode ? mediumStarDark : mediumStarLight} />
                <Star3 src={prefersDarkMode ? smallStarDark : smallStarLight} />
              </IllustrationContainer>
            </AnimatedProductOptionContent>
          </ProductOption>
        );
      })}
    </Fragment>
  );
}

export default ProductSelect;

const ProductOption = styled(PanelItem)<{isNewCheckout?: boolean; isSelected?: boolean}>`
  margin: ${p => (p.isNewCheckout ? '0' : p.theme.space.lg)};
  padding: 0;
  display: inherit;
  cursor: pointer;
`;

const ProductOptionContent = styled('div')<{
  isNewCheckout?: boolean;
  isSelected?: boolean;
}>`
  padding: ${p => p.theme.space.xl};
  display: flex;
  flex-direction: ${p => (p.isNewCheckout ? 'row' : 'column')};
  justify-content: ${p => (p.isNewCheckout ? 'space-between' : 'flex-start')};
  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => p.theme.innerBorder};
  width: 100%;

  ${p =>
    p.isNewCheckout &&
    !p.isSelected &&
    css`
      background-color: ${p.theme.background};
    `}

  ${p =>
    p.isNewCheckout &&
    p.isSelected &&
    css`
      color: ${p.theme.activeText};
      border-color: ${p.theme.active};
      background-color: ${p.theme.active}05;
    `}
`;

const AnimatedProductOptionContent = styled(ProductOptionContent)<{
  prefersDarkMode: boolean;
  buttonBorderColor?: string;
  gradientColor?: string;
}>`
  background-color: ${p =>
    p.isSelected && p.gradientColor ? p.gradientColor : p.theme.backgroundSecondary};
  border: 1px solid
    ${p => (p.isSelected && p.gradientColor ? p.gradientColor : p.theme.innerBorder)};

  button {
    border-color: ${p =>
      p.isSelected && p.buttonBorderColor ? p.buttonBorderColor : p.theme.innerBorder};
    background-color: ${p => (p.isSelected ? 'transparent' : p.theme.background)};
  }

  @keyframes gradient {
    0% {
      background-position: 0% 50%;
    }
    100% {
      background-position: 100% 50%;
    }
  }

  --star-1-translate: 0, 0;
  --star-2-translate: 0, 0;
  --star-3-translate: 0, 0;

  ${p =>
    p.isSelected &&
    css`
      --star-1-translate: -3px, 7px;
      --star-2-translate: 6px, -2px;
      --star-3-translate: 0px, -5px;
    `}

  img {
    transition: transform 0.2s ease-out;
  }

  img:nth-child(1) {
    transform: translate(var(--star-1-translate));
  }

  img:nth-child(2) {
    transform: translate(var(--star-2-translate));
  }

  img:nth-child(3) {
    transform: translate(var(--star-3-translate));
  }

  ${p =>
    !p.isSelected &&
    p.gradientColor &&
    css`
      &:hover {
        background: linear-gradient(
          0.33turn,
          ${p.gradientColor},
          ${p.theme.background},
          ${p.gradientColor},
          ${p.theme.background}
        );
        background-size: 400% 400%;
        animation: gradient 4s ease-in-out infinite;
        border-color: ${p.gradientColor};

        img:nth-child(1) {
          transition: transform 0.2s ease-in;
          transform: translate(-3px, 7px);
        }

        img:nth-child(2) {
          transition: transform 0.2s ease-in;
          transform: translate(6px, -2px);
        }

        img:nth-child(3) {
          transition: transform 0.2s ease-in;
          transform: translate(0px, -5px);
        }
      }
    `}
`;

const Column = styled('div')<{alignItems?: string}>`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.sm};
  align-items: ${p => p.alignItems};
`;

const Row = styled('div')`
  display: flex;
  gap: ${p => p.theme.space['3xl']};
  justify-content: space-between;
`;

const ProductLabel = styled('div')<{productColor?: string}>`
  display: flex;
  align-items: center;
  flex-direction: row;
  flex-wrap: nowrap;
  gap: ${p => p.theme.space.md};

  ${p =>
    p.productColor &&
    css`
      color: ${p.productColor};
    `}
`;

const ProductName = styled('div')`
  font-size: ${p => p.theme.fontSize.xl};
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const ProductDescription = styled('p')<{colorOverride?: string; isNewCheckout?: boolean}>`
  margin: ${p => (p.isNewCheckout ? `0` : `${p.theme.space.xs} 0 ${p.theme.space.xl}`)};
  font-weight: ${p =>
    p.isNewCheckout ? p.theme.fontWeight.normal : p.theme.fontWeight.bold};

  ${p =>
    p.colorOverride &&
    css`
      color: ${p.colorOverride};
    `}
  text-wrap: balance;
`;

const PriceContainer = styled(Column)`
  gap: 0px;
`;

const PriceHeader = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.sm};
  text-transform: uppercase;
  font-weight: bold;
`;

const Price = styled('div')`
  display: inline-grid;
  grid-template-columns: repeat(3, auto);
  color: ${p => p.theme.textColor};
`;

const Currency = styled('span')`
  padding-top: ${p => p.theme.space.xs};
`;

const Amount = styled('span')<{isNewCheckout?: boolean}>`
  font-size: ${p => (p.isNewCheckout ? p.theme.fontSize['2xl'] : '24px')};
  align-self: ${p => (p.isNewCheckout ? 'start' : 'end')};
  font-weight: ${p =>
    p.isNewCheckout ? p.theme.fontWeight.bold : p.theme.fontWeight.normal};
`;

const BillingInterval = styled('span')<{isNewCheckout?: boolean}>`
  font-size: ${p => (p.isNewCheckout ? p.theme.fontSize.lg : p.theme.fontSize.md)};
  align-self: ${p => (p.isNewCheckout ? 'start' : 'end')};
  padding-bottom: ${p => p.theme.space['2xs']};
`;

const EventPriceTag = styled(Tag)`
  display: flex;
  align-items: center;
  line-height: normal;
  width: fit-content;
  font-weight: normal;
`;

const IconContainer = styled('div')`
  margin-top: ${p => p.theme.space['2xs']};
  display: flex;
  align-items: center;
`;

const StyledButton = styled(Button)`
  width: 100%;
  margin: ${p => p.theme.space.lg} 0 ${p => p.theme.space.xs};
`;

const ButtonContent = styled('div')<{color: string}>`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.md};
  color: ${p => p.color};
`;

const Features = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  column-gap: ${p => p.theme.space.xl};
`;

const Feature = styled(Column)`
  font-size: ${p => p.theme.fontSize.sm};
`;

const FeatureHeader = styled(Row)`
  justify-content: flex-start;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;

  > span {
    margin-right: ${p => p.theme.space.sm};
    font-weight: 600;
  }
`;

const FeatureDescription = styled('div')`
  text-wrap: balance;
  margin-left: ${p => p.theme.space['2xl']};
  max-width: unset;

  @media (max-width: 700px) or ((min-width: 1200px) and (max-width: 1300px)) or ((min-width: 1400px) and (max-width: 1500px)) {
    max-width: 250px;
  }
`;

const IllustrationContainer = styled('div')`
  display: none;

  @media (min-width: ${p => p.theme.breakpoints.xs}) {
    display: block;
    position: absolute;
    bottom: 0px;
    right: 12px;
    height: 175px;
    width: 200px;
    overflow: hidden;
    border-radius: 0 ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 0;
    pointer-events: none;
  }
`;

const FeatureItem = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  display: grid;
  grid-template-columns: ${p => p.theme.space.xl} 1fr;
  align-items: start;
  color: ${p => p.theme.textColor};
  gap: ${p => p.theme.space.md};
`;

const Star1 = styled('img')`
  position: absolute;
  top: 7.1px;
  right: 20.6px;
`;

const Star2 = styled('img')`
  position: absolute;
  top: 32px;
  right: 92.6px;
`;

const Star3 = styled('img')`
  position: absolute;
  top: 71.7px;
  right: 15.4px;
`;
