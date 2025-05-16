import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {SeerIcon} from 'sentry/components/ai/SeerIcon';
import {Button} from 'sentry/components/core/button';
import PanelItem from 'sentry/components/panels/panelItem';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {IconAdd, IconCheckmark} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';
import type {Color} from 'sentry/utils/theme';

import formatCurrency from 'getsentry/utils/formatCurrency';
import {SelectableProduct, type StepProps} from 'getsentry/views/amCheckout/types';
import * as utils from 'getsentry/views/amCheckout/utils';

function ProductSelect({
  activePlan,
  // billingConfig,
  formData,
  // onEdit,
  onUpdate,
  // subscription,
  organization,
}: Pick<StepProps, 'activePlan' | 'organization' | 'onUpdate' | 'formData'>) {
  const availableProducts = Object.values(activePlan.availableReservedBudgetTypes)
    .filter(
      productInfo =>
        productInfo.isFixed && // NOTE: for now, we only supported fixed budget products in checkout
        productInfo.billingFlag &&
        organization.features.includes(productInfo.billingFlag)
    )
    .map(productInfo => {
      return productInfo;
    });

  const theme = useTheme();
  const PRODUCT_CHECKOUT_INFO = {
    [SelectableProduct.SEER]: {
      icon: <SeerIcon size="lg" color={'pink400'} />,
      color: theme.pink400 as Color,
      gradientEndColor: theme.pink100 as Color,
      description: 'Detect and fix issues faster with our AI debugging agent.',
      features: ['Issue scan', 'Root cause analysis', 'Solution and code changes'],
    },
  };
  const billingInterval = utils.getShortInterval(activePlan.billingInterval);

  return (
    <Fragment>
      <Separator />
      {availableProducts.map(productInfo => {
        const checkoutInfo =
          PRODUCT_CHECKOUT_INFO[productInfo.apiName as string as SelectableProduct];
        if (!checkoutInfo) {
          return null;
        }

        return (
          <ProductOption key={productInfo.apiName} aria-label={productInfo.productName}>
            <ProductOptionContent gradientColor={checkoutInfo.gradientEndColor}>
              <Column>
                <ProductLabel productColor={checkoutInfo.color}>
                  {checkoutInfo.icon}
                  <ProductName>{toTitleCase(productInfo.productName)}</ProductName>
                </ProductLabel>
                <div>
                  <p>{checkoutInfo.description}</p>
                  {checkoutInfo.features.map(feature => (
                    <Feature key={feature}>
                      <IconCheckmark color={checkoutInfo.color} />
                      {feature}
                    </Feature>
                  ))}
                </div>
              </Column>
              <Column alignItems="flex-end">
                <Button
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
                  <ButtonContent
                    color={
                      formData.selectedProducts?.[
                        productInfo.apiName as string as SelectableProduct
                      ]?.enabled
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
                        <IconAdd /> {formatCurrency(productInfo.defaultBudget!)}/
                        {billingInterval}
                      </Fragment>
                    )}
                  </ButtonContent>
                </Button>
                <Subtitle>
                  {t('Extra usage requires PAYG ')}
                  <QuestionTooltip
                    title={tct(
                      'Any [productName] usage beyond the monthly prepaid budget will be charged to your pay-as-you-go budget.',
                      {productName: toTitleCase(productInfo.productName)}
                    )} // TODO(seer): fix copy i just made this up
                    position="top"
                    size="xs"
                  />
                </Subtitle>
              </Column>
            </ProductOptionContent>
            {/* </motion.div> */}
          </ProductOption>
        );
      })}
    </Fragment>
  );

  // const renderSeer = () => {
  //   return renderAdditionalFeature({
  //     featureKey: 'seer',
  //     featureEnabled: seerIsEnabled,
  //     featureAvailable: hasSeerFeature,
  //     title: 'Add Seer, our AI Agent',
  //     description: 'Insights and solutions to fix bugs faster',
  //     icon: <SeerIcon size="lg" />,
  //     priceCents: SEER_MONTHLY_PRICE_CENTS,
  //     featureItems: ['Root Cause Analysis', 'Autofix PRs', 'AI Issue Priority'],
  //     tooltipTitle: t('Additional Seer information.'),
  //     isNew: true,
  //     setFeatureEnabled: setSeerIsEnabled,
  //   });
  // };
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
`;

const ProductOptionContent = styled('div')<{gradientColor: string}>`
  padding: ${space(2)};
  background-color: ${p => p.theme.backgroundSecondary};
  display: flex;
  gap: ${space(4)};
  justify-content: space-between;
  border: 1px solid ${p => p.theme.innerBorder};
  border-radius: ${p => p.theme.borderRadius};

  @keyframes gradient {
    0% {
      background-position: 0% 50%;
    }
    100% {
      background-position: 100% 50%;
    }
  }

  &:hover {
    background: linear-gradient(
      0.33turn,
      ${p => p.gradientColor},
      ${p => p.theme.background},
      ${p => p.gradientColor},
      ${p => p.theme.background}
    );
    background-size: 400% 400%;
    animation: gradient 4s ease-in-out infinite;
    border-color: ${p => p.gradientColor};

    button {
      border-color: ${p => p.gradientColor};
    }
  }
`;

const Column = styled('div')<{alignItems?: string}>`
  display: flex;
  flex-direction: column;
  gap: ${space(0.75)};
  align-items: ${p => p.alignItems};
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
`;
