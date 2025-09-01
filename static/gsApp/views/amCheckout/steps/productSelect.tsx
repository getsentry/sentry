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
import PanelItem from 'sentry/components/panels/panelItem';
import {IconAdd, IconCheckmark} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {DataCategory} from 'sentry/types/core';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';
import type {Color} from 'sentry/utils/theme';

import {getProductIcon} from 'getsentry/utils/billing';
import {getSingularCategoryName} from 'getsentry/utils/dataCategory';
import formatCurrency from 'getsentry/utils/formatCurrency';
import {SelectableProduct, type StepProps} from 'getsentry/views/amCheckout/types';
import * as utils from 'getsentry/views/amCheckout/utils';

function ProductSelect({
  activePlan,
  formData,
  onUpdate,
  isNewCheckout,
}: Pick<StepProps, 'activePlan' | 'onUpdate' | 'formData' | 'isNewCheckout'>) {
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
      color: theme.pink400 as Color,
      gradientEndColor: theme.pink100 as Color,
      buttonBorderColor: theme.pink200 as Color,
      getProductDescription: (includedBudget: string) =>
        isNewCheckout
          ? t('Detect and fix issues faster with our AI agent')
          : tct(
              'Detect and fix issues faster with [includedBudget]/mo in credits towards our AI agent',
              {
                includedBudget,
              }
            ),
      categoryInfo: {
        [DataCategory.SEER_AUTOFIX]: {
          perEventNameOverride: isNewCheckout ? 'run' : 'fix',
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
      {!isNewCheckout && <Separator />}
      {availableProducts.map(productInfo => {
        const checkoutInfo =
          PRODUCT_CHECKOUT_INFO[productInfo.apiName as string as SelectableProduct];
        if (!checkoutInfo) {
          return null;
        }

        const productIcon = getProductIcon(
          productInfo.apiName as string as SelectableProduct,
          'lg'
        );

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

        const isSelected =
          formData.selectedProducts?.[productInfo.apiName as string as SelectableProduct]
            ?.enabled;

        const ariaLabel = t('Add %s to plan', productInfo.productCheckoutName);

        const toggleProductOption = () => {
          onUpdate({
            selectedProducts: {
              ...formData.selectedProducts,
              [productInfo.apiName]: {
                enabled: !isSelected,
              },
            },
          });
        };

        if (isNewCheckout) {
          return (
            <ProductOption
              key={productInfo.apiName}
              aria-label={ariaLabel}
              data-test-id={`product-option-${productInfo.apiName}`}
              onClick={toggleProductOption}
              isNewCheckout={isNewCheckout}
            >
              <ProductOptionContent isSelected={isSelected} isNewCheckout>
                <Column>
                  {productIcon}
                  <ProductLabel>
                    <ProductName>
                      {toTitleCase(productInfo.productCheckoutName, {
                        allowInnerUpperCase: true,
                      })}
                    </ProductName>
                  </ProductLabel>
                  <ProductDescription
                    isNewCheckout
                    colorOverride={isSelected ? undefined : theme.subText}
                  >
                    {checkoutInfo.getProductDescription(formattedMonthlyBudget)}
                  </ProductDescription>
                  <div>
                    <Amount isNewCheckout>{`+$${priceInDollars}`}</Amount>
                    <BillingInterval
                      isNewCheckout
                    >{`/${billingInterval}`}</BillingInterval>
                  </div>
                  <Separator />
                  <FeatureItem data-test-id={`product-option-feature-credits`}>
                    <IconContainer>
                      <IconCheckmark color={theme.activeText as Color} />
                    </IconContainer>
                    <span>
                      {tct('Includes [includedBudget]/mo in credits', {
                        includedBudget: formattedMonthlyBudget,
                      })}
                    </span>
                  </FeatureItem>
                  {Object.entries(checkoutInfo.categoryInfo).map(([category, info]) => {
                    const pricingInfo =
                      activePlan.planCategories[category as DataCategory];
                    const eventPrice = pricingInfo ? pricingInfo[1]?.onDemandPrice : null;
                    return (
                      <FeatureItem
                        key={category}
                        data-test-id={`product-option-feature-${category}`}
                      >
                        <IconContainer>
                          <IconCheckmark color={theme.activeText as Color} />
                        </IconContainer>
                        <div>
                          <FeatureItemCategory>
                            {getSingularCategoryName({
                              plan: activePlan,
                              category: category as DataCategory,
                              hadCustomDynamicSampling: false,
                              title: true,
                            })}
                            {':'}
                          </FeatureItemCategory>
                          <span>
                            {info.description}.{' '}
                            {eventPrice &&
                              `${utils.displayUnitPrice({cents: eventPrice, minDigits: 0, maxDigits: info.maxEventPriceDigits})}/${info.perEventNameOverride ?? getSingularCategoryName({plan: activePlan, category: category as DataCategory, hadCustomDynamicSampling: false, capitalize: false})}`}
                          </span>
                        </div>
                      </FeatureItem>
                    );
                  })}
                </Column>
                <Column>
                  <Checkbox
                    aria-label={ariaLabel}
                    aria-checked={isSelected}
                    checked={isSelected}
                    onChange={toggleProductOption}
                    onKeyDown={({key}) => {
                      if (key === 'Enter') {
                        toggleProductOption();
                      }
                    }}
                  />
                </Column>
              </ProductOptionContent>
            </ProductOption>
          );
        }

        return (
          <ProductOption
            key={productInfo.apiName}
            aria-label={productInfo.productCheckoutName}
            data-test-id={`product-option-${productInfo.apiName}`}
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
            </AnimatedProductOptionContent>
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
  buttonBorderColor: string;
  gradientColor: string;
  prefersDarkMode: boolean;
}>`
  background-color: ${p =>
    p.isSelected ? p.gradientColor : p.theme.backgroundSecondary};
  border: 1px solid ${p => (p.isSelected ? p.gradientColor : p.theme.innerBorder)};

  button {
    border-color: ${p => (p.isSelected ? p.buttonBorderColor : p.theme.innerBorder)};
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
  margin-right: ${p => p.theme.space.md};
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
  gap: 0px;
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
  grid-template-columns: min-content 1fr;
  align-items: start;
  color: ${p => p.theme.textColor};
`;

const FeatureItemCategory = styled('span')`
  font-weight: ${p => p.theme.fontWeight.bold};
  margin-right: ${p => p.theme.space.xs};
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
