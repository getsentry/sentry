import {Fragment} from 'react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import largeStarLight from 'sentry-images/spot/product-select-star-l.svg';
import largeStarDark from 'sentry-images/spot/product-select-star-l-dark.svg';
import mediumStarLight from 'sentry-images/spot/product-select-star-m.svg';
import mediumStarDark from 'sentry-images/spot/product-select-star-m-dark.svg';
import smallStarLight from 'sentry-images/spot/product-select-star-s.svg';
import smallStarDark from 'sentry-images/spot/product-select-star-s-dark.svg';

import {Tag} from 'sentry/components/core/badge/tag';
import {Button} from 'sentry/components/core/button';
import PanelItem from 'sentry/components/panels/panelItem';
import {IconAdd, IconCheckmark, IconSeer} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import {DataCategory} from 'sentry/types/core';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';
import type {Color} from 'sentry/utils/theme';

import {getSingularCategoryName} from 'getsentry/utils/dataCategory';
import formatCurrency from 'getsentry/utils/formatCurrency';
import {SelectableProduct, type StepProps} from 'getsentry/views/amCheckout/types';
import * as utils from 'getsentry/views/amCheckout/utils';

function ProductSelect({
  activePlan,
  formData,
  onUpdate,
}: Pick<StepProps, 'activePlan' | 'onUpdate' | 'formData'>) {
  const availableProducts = Object.values(activePlan.availableReservedBudgetTypes)
    .filter(
      productInfo =>
        productInfo.isFixed && // NOTE: for now, we only supported fixed budget products in checkout
        productInfo.billingFlag &&
        activePlan.features.includes(productInfo.billingFlag)
    )
    .map(productInfo => {
      return productInfo;
    });

  const theme = useTheme();
  const PRODUCT_CHECKOUT_INFO = {
    [SelectableProduct.SEER]: {
      icon: <IconSeer size="lg" color="pink400" />,
      color: theme.pink400 as Color,
      gradientEndColor: theme.pink100 as Color,
      buttonBorderColor: theme.pink200 as Color,
      getProductDescription: (includedBudget: string) =>
        tct(
          'Detect and fix issues faster with [includedBudget]/mo in credits towards our AI agent',
          {
            includedBudget,
          }
        ),
      categoryInfo: {
        [DataCategory.SEER_AUTOFIX]: {
          perEventNameOverride: 'fix',
          description: t(
            'Uses the latest AI models with Sentry data to find root causes & proposes PRs'
          ),
          maxEventPriceDigits: 0,
        },
        [DataCategory.SEER_SCANNER]: {
          perEventNameOverride: 'scan',
          description: t(
            'Triages issues as they happen, automatically flagging highly-fixable ones for followup'
          ),
          maxEventPriceDigits: 3,
        },
      },
    },
  };
  const billingInterval = utils.getShortInterval(activePlan.billingInterval);
  const prefersDarkMode = useLegacyStore(ConfigStore).theme === 'dark';

  return (
    <Fragment>
      <Separator />
      {availableProducts.map(productInfo => {
        const checkoutInfo =
          PRODUCT_CHECKOUT_INFO[productInfo.apiName as string as SelectableProduct];
        if (!checkoutInfo) {
          return null;
        }

        // how much the customer is paying for the product
        const priceInCents = utils.getReservedPriceForReservedBudgetCategory({
          plan: activePlan,
          reservedBudgetCategory: productInfo.apiName,
        });
        const priceInDollars = utils.formatPrice({
          cents: priceInCents,
        });

        // how much the customer gets per month for the product
        // if no default budget, then the included budget is how much the customer is paying for the product
        const formattedMonthlyBudget = formatCurrency(
          productInfo.defaultBudget ?? priceInCents
        );

        return (
          <ProductOption
            key={productInfo.apiName}
            aria-label={productInfo.productName}
            data-test-id={`product-option-${productInfo.apiName}`}
            onClick={() =>
              onUpdate({
                selectedProducts: {
                  ...formData.selectedProducts,
                  [productInfo.apiName]: {
                    enabled:
                      !formData.selectedProducts?.[
                        productInfo.apiName as string as SelectableProduct
                      ]?.enabled,
                  },
                },
              })
            }
          >
            <ProductOptionContent
              gradientColor={checkoutInfo.gradientEndColor}
              buttonBorderColor={checkoutInfo.buttonBorderColor}
              enabled={
                formData.selectedProducts?.[
                  productInfo.apiName as string as SelectableProduct
                ]?.enabled
              }
              prefersDarkMode={prefersDarkMode}
            >
              <Row>
                <Column>
                  <ProductLabel productColor={checkoutInfo.color}>
                    {checkoutInfo.icon}
                    <ProductName>
                      {toTitleCase(productInfo.productCheckoutName, {
                        allowInnerUpperCase: true,
                      })}
                    </ProductName>
                  </ProductLabel>
                  <ProductDescription>
                    {checkoutInfo.getProductDescription(formattedMonthlyBudget)}
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
                          <EventPriceTag>{`${utils.displayUnitPrice({cents: eventPrice, minDigits: 0, maxDigits: info.maxEventPriceDigits})} / ${info.perEventNameOverride ?? getSingularCategoryName({plan: activePlan, category: category as DataCategory, hadCustomDynamicSampling: false, capitalize: false})}`}</EventPriceTag>
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
                      formData.selectedProducts?.[
                        productInfo.apiName as string as SelectableProduct
                      ]?.enabled && !prefersDarkMode
                        ? checkoutInfo.color
                        : theme.textColor
                    }
                  >
                    {formData.selectedProducts?.[
                      productInfo.apiName as string as SelectableProduct
                    ]?.enabled ? (
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
            </ProductOptionContent>
          </ProductOption>
        );
      })}
    </Fragment>
  );
}

export default ProductSelect;

const Separator = styled('div')`
  border-top: 1px solid ${p => p.theme.innerBorder};
  margin: 0;
`;

const ProductOption = styled(PanelItem)<{isSelected?: boolean}>`
  margin: ${space(1.5)};
  padding: 0;
  display: inherit;
  cursor: pointer;
`;

const ProductOptionContent = styled('div')<{
  buttonBorderColor: string;
  gradientColor: string;
  prefersDarkMode: boolean;
  enabled?: boolean;
}>`
  padding: ${space(2)};
  background-color: ${p => (p.enabled ? p.gradientColor : p.theme.backgroundSecondary)};
  display: flex;
  flex-direction: column;
  border: 1px solid ${p => (p.enabled ? p.gradientColor : p.theme.innerBorder)};
  border-radius: ${p => p.theme.borderRadius};

  button {
    border-color: ${p => (p.enabled ? p.buttonBorderColor : p.theme.innerBorder)};
    background-color: ${p => (p.enabled ? 'transparent' : p.theme.background)};
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
    p.enabled &&
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
    !p.enabled &&
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
  gap: ${space(0.75)};
  align-items: ${p => p.alignItems};
`;

const Row = styled('div')`
  display: flex;
  gap: ${space(4)};
  justify-content: space-between;
`;

const ProductLabel = styled('div')<{productColor: string}>`
  display: flex;
  align-items: center;
  flex-direction: row;
  flex-wrap: nowrap;
  gap: ${space(1)};
  color: ${p => p.productColor};
`;

const ProductName = styled('div')`
  font-size: ${p => p.theme.fontSize.xl};
  font-weight: 600;
`;

const ProductDescription = styled('p')`
  margin: ${space(0.5)} 0 ${space(2)};
  font-weight: 600;
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
  padding-top: ${space(0.5)};
`;

const Amount = styled('span')`
  font-size: 24px;
  align-self: end;
`;

const BillingInterval = styled('span')`
  font-size: ${p => p.theme.fontSize.md};
  align-self: end;
  padding-bottom: ${space(0.25)};
`;

const EventPriceTag = styled(Tag)`
  display: flex;
  align-items: center;
  line-height: normal;
  width: fit-content;
  font-weight: normal;
`;

const IconContainer = styled('div')`
  margin-right: ${space(1)};
  display: flex;
  align-items: center;
`;

const StyledButton = styled(Button)`
  width: 100%;
  margin: ${space(1.5)} 0 ${space(0.5)};
`;

const ButtonContent = styled('div')<{color: string}>`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  color: ${p => p.color};
`;

const Features = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  column-gap: ${space(2)};
`;

const Feature = styled(Column)`
  font-size: ${p => p.theme.fontSize.sm};
`;

const FeatureHeader = styled(Row)`
  justify-content: flex-start;
  flex-wrap: wrap;
  gap: 0px;
  align-items: center;

  > span {
    margin-right: ${space(0.75)};
    font-weight: 600;
  }
`;

const FeatureDescription = styled('div')`
  text-wrap: balance;
  margin-left: ${space(3)};
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
