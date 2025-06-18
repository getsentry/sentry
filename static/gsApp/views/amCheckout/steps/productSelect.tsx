import {Fragment} from 'react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import largeStarLight from 'sentry-images/spot/product-select-star-l.svg';
import largeStarDark from 'sentry-images/spot/product-select-star-l-dark.svg';
import mediumStarLight from 'sentry-images/spot/product-select-star-m.svg';
import mediumStarDark from 'sentry-images/spot/product-select-star-m-dark.svg';
import smallStarLight from 'sentry-images/spot/product-select-star-s.svg';
import smallStarDark from 'sentry-images/spot/product-select-star-s-dark.svg';

import {Button} from 'sentry/components/core/button';
import PanelItem from 'sentry/components/panels/panelItem';
import {IconAdd, IconCheckmark, IconSeer} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';
import type {Color} from 'sentry/utils/theme';

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
      description: t('Detect and fix issues faster with our AI debugging agent.'),
      features: [
        t('Issue scan'),
        t('Root cause analysis'),
        t('Solution and code changes'),
      ],
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

        const cost = formatCurrency(
          utils.getReservedPriceForReservedBudgetCategory({
            plan: activePlan,
            reservedBudgetCategory: productInfo.apiName,
          })
        );

        // if no default budget, then the included budget is how much the customer is paying for the product
        const includedBudget = productInfo.defaultBudget
          ? formatCurrency(productInfo.defaultBudget)
          : cost;

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
                  <p>{checkoutInfo.description}</p>
                </Column>
                <Column>
                  {checkoutInfo.features.map(feature => (
                    <Feature key={feature}>
                      <IconCheckmark color={checkoutInfo.color} />
                      {feature}
                    </Feature>
                  ))}
                </Column>
              </Row>
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
                        {tct(' Add for [cost]/[billingInterval]', {
                          cost,
                          billingInterval,
                        })}
                      </Fragment>
                    )}
                  </ButtonContent>
                </StyledButton>
              </Row>
              <Row justifyContent="center">
                <Subtitle>
                  {tct(
                    'Includes [includedBudget]/mo of credits for [productName] services. Additional usage is drawn from your [budgetTerm] budget.',
                    {
                      includedBudget,
                      budgetTerm:
                        activePlan.budgetTerm === 'pay-as-you-go'
                          ? 'PAYG'
                          : activePlan.budgetTerm,
                      productName: toTitleCase(productInfo.productName),
                    }
                  )}
                </Subtitle>
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

const Row = styled('div')<{justifyContent?: string}>`
  display: flex;
  gap: ${space(4)};
  justify-content: ${p => p.justifyContent ?? 'flex-start'};
  align-items: center;
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
  font-size: ${p => p.theme.fontSizeExtraLarge};
  font-weight: 600;
`;

const Subtitle = styled('p')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  text-align: center;
  margin: 0;
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

const Feature = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
  align-content: center;
  svg {
    flex-shrink: 0;
  }
  font-size: ${p => p.theme.fontSizeSmall};
`;

const IllustrationContainer = styled('div')`
  display: none;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    display: block;
    position: absolute;
    bottom: 84px;
    right: 12px;
    height: 175px;
    width: 200px;
    overflow: hidden;
    border-radius: 0 ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 0;
    pointer-events: none;
  }

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    display: none;
  }

  @media (min-width: ${p => p.theme.breakpoints.xlarge}) {
    display: block;
    position: absolute;
    bottom: 84px;
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
