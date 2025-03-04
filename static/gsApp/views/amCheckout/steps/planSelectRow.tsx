import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Tag} from 'sentry/components/core/badge/tag';
import {Radio} from 'sentry/components/core/radio';
import PanelItem from 'sentry/components/panels/panelItem';
import {IconBusiness, IconCheckmark} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

import type {Plan, Promotion} from 'getsentry/types';
import MoreFeaturesLink from 'getsentry/views/amCheckout/moreFeaturesLink';
import type {PlanContent} from 'getsentry/views/amCheckout/steps/planSelect';
import {formatPrice, getShortInterval} from 'getsentry/views/amCheckout/utils';

type Props = {
  isSelected: boolean;
  onUpdate: (data: {plan: string}) => void;
  plan: Plan;
  planContent: PlanContent;
  planName: string;
  planValue: string;
  price: string;
  priceHeader: React.ReactNode;
  badge?: React.ReactNode;
  discountInfo?: Promotion['discountInfo'];
  highlightedFeatures?: string[];
  isFeaturesCheckmarked?: boolean;

  /**
   * Optional list of main features for a plan
   */
  planFeatures?: string[];

  /**
   * Optional warning at the bottom of the row
   */
  planWarning?: React.ReactNode;
};

function PlanSelectRow({
  plan,
  isSelected,
  onUpdate,
  planValue,
  planName,
  planContent,
  priceHeader,
  price,
  planWarning,
  highlightedFeatures,
  isFeaturesCheckmarked,
  discountInfo,
  badge,
}: Props) {
  const billingInterval = getShortInterval(plan.billingInterval);
  const {features, description, hasMoreLink} = planContent;

  const icon = isFeaturesCheckmarked ? (
    <IconCheckmark legacySize="14px" />
  ) : (
    <IconBusiness data-test-id="plan-icon-business" legacySize="14px" />
  );

  const describeId = `plan-details-${plan.id}`;
  const hasFeatures = !!Object.keys(features || {}).length;

  return (
    <PlanOption isSelected={isSelected} data-test-id={plan.id}>
      <Label aria-label={planName} aria-describedby={describeId}>
        <StyledPlan hasFeatures={hasFeatures}>
          <PlanContainer>
            <StyledRadio
              readOnly
              id={plan.id}
              value={planValue}
              checked={isSelected}
              onClick={() => onUpdate({plan: plan.id})}
            />
            <PlanDetails id={`plan-details-${plan.id}`}>
              <Title>
                <PlanName>{planName}</PlanName>
                {badge}
              </Title>
              <Description id={describeId}>{description}</Description>
              {features &&
                (highlightedFeatures && highlightedFeatures.length > 0 ? (
                  <FeatureList>
                    {Object.entries(features)
                      .filter(([featureId, _]) => highlightedFeatures.includes(featureId))
                      .map(([featureId, feature]) => (
                        <Feature key={featureId}>
                          {/* custom to match text size */}
                          <IconBusiness legacySize="14px" gradient />
                          {
                            // Only shows hovercard when one feature was highlighted
                            highlightedFeatures.length === 1 ? (
                              <Fragment>
                                <strong>{feature}</strong>
                                <Tag>{t('Looking for this?')}</Tag>
                              </Fragment>
                            ) : (
                              <b>{feature}</b>
                            )
                          }
                        </Feature>
                      ))}
                    {Object.entries(features)
                      .filter(
                        ([featureId, _]) => !highlightedFeatures.includes(featureId)
                      )
                      .map(([featureId, feature]) => (
                        <Feature key={featureId}>
                          {/* custom to match text size */}
                          {icon}
                          {feature}
                        </Feature>
                      ))}
                    {/* custom to match text size */}
                    {hasMoreLink && <MoreFeaturesLink iconSize="14px" />}
                  </FeatureList>
                ) : (
                  <FeatureList>
                    {Object.entries(features).map(([featureId, feature]) => (
                      <Feature key={featureId}>
                        {/* custom to match text size */}
                        {icon}
                        {feature}
                      </Feature>
                    ))}
                    {/* custom to match text size */}
                    {hasMoreLink && <MoreFeaturesLink iconSize="14px" />}
                  </FeatureList>
                ))}
            </PlanDetails>
          </PlanContainer>

          <PriceContainer hasFeatures={hasFeatures}>
            <PriceHeader>{priceHeader}</PriceHeader>
            <Price>
              <Currency>$</Currency>
              <Amount>{price}</Amount>
              <BillingInterval>{`/${billingInterval}`}</BillingInterval>
            </Price>
            {discountInfo && (
              <DiscountWrapper>
                <OriginalTotal>{`$${formatPrice({
                  cents: plan.basePrice,
                })}/${billingInterval}`}</OriginalTotal>
                <PercentOff>
                  {tct('([percentOff]% off)', {
                    percentOff: discountInfo.amount / 100,
                  })}
                </PercentOff>
              </DiscountWrapper>
            )}
          </PriceContainer>
        </StyledPlan>

        {planWarning}
      </Label>
    </PlanOption>
  );
}

export default PlanSelectRow;

const PlanOption = styled(PanelItem)<{isSelected?: boolean}>`
  padding: 0;
  border-bottom: 1px solid ${p => p.theme.innerBorder};

  ${p =>
    p.isSelected &&
    css`
      background: ${p.theme.backgroundSecondary};
      color: ${p.theme.textColor};
    `}
`;

const Label = styled('label')`
  display: grid;
  grid-template-rows: auto;
  padding: ${space(2)};
  font-weight: normal;
  width: 100%;
  margin: 0;
`;

const StyledPlan = styled('div')<{hasFeatures?: boolean}>`
  display: grid;
  grid-template-columns: minmax(auto, 70%) max-content;
  gap: ${space(1.5)};
  justify-content: space-between;
  align-items: center;

  ${p =>
    p.hasFeatures &&
    css`
      align-items: start;
    `}
`;

const PlanContainer = styled('div')`
  display: grid;
  grid-template-columns: max-content auto;
  gap: ${space(1.5)};
`;

const PriceContainer = styled('div')<{hasFeatures?: boolean}>`
  display: grid;
  gap: ${space(0.5)};
  grid-template-rows: repeat(2, auto);
  justify-items: end;

  ${p =>
    p.hasFeatures &&
    css`
      padding-top: ${space(1.5)};
    `}
`;

const StyledRadio = styled(Radio)`
  background: ${p => p.theme.background};
`;

const PlanDetails = styled('div')`
  display: inline-grid;
  gap: ${space(0.75)};
  font-size: ${p => p.theme.fontSizeExtraLarge};
  color: ${p => p.theme.textColor};
`;

const PlanName = styled('div')`
  font-weight: 600;
`;

const Description = styled(TextBlock)`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.gray300};
  margin: 0;
`;

const PriceHeader = styled('div')`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeSmall};
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
  font-size: ${p => p.theme.fontSizeMedium};
  align-self: end;
  padding-bottom: ${space(0.25)};
`;

const FeatureList = styled('div')`
  display: grid;
  grid-template-rows: auto;
  gap: ${space(1)};
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.gray300};

  > a {
    width: fit-content;
  }
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

const Title = styled('div')`
  display: flex;
  align-items: center;
  flex-direction: row;
  flex-wrap: nowrap;
  gap: ${space(1)};
`;

const OriginalTotal = styled('div')`
  color: ${p => p.theme.gray300};
  text-decoration: line-through;
  font-size: ${p => p.theme.fontSizeSmall};
`;

const DiscountWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;

const PercentOff = styled('span')`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeSmall};
`;
