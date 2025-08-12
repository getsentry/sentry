import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Tag} from 'sentry/components/core/badge/tag';
import {Flex} from 'sentry/components/core/layout';
import {Radio} from 'sentry/components/core/radio';
import {Tooltip} from 'sentry/components/core/tooltip';
import {IconCheckmark, IconInfo, IconLightning} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import type {Color} from 'sentry/utils/theme';

import {PAYG_BUSINESS_DEFAULT, PAYG_TEAM_DEFAULT} from 'getsentry/constants';
import {OnDemandBudgetMode} from 'getsentry/types';
import {isBizPlanFamily} from 'getsentry/utils/billing';
import {getPlanCategoryName} from 'getsentry/utils/dataCategory';
import MoreFeaturesLink from 'getsentry/views/amCheckout/moreFeaturesLink';
import type {
  PlanSelectRowProps,
  PlanUpdateData,
} from 'getsentry/views/amCheckout/steps/planSelectRow';
import {displayUnitPrice, getShortInterval} from 'getsentry/views/amCheckout/utils';

function PlanSelectCard({
  plan,
  isSelected,
  onUpdate,
  planValue,
  planName,
  planContent,
  price,
  highlightedFeatures,
  badge,
  shouldShowDefaultPayAsYouGo = false,
  planIcon,
  shouldShowEventPrice = false,
  priorPlanName,
}: Omit<
  PlanSelectRowProps,
  'isFeaturesCheckmarked' | 'discountInfo' | 'planWarning' | 'priceHeader'
> & {
  planIcon: React.ReactNode;
  priorPlanName?: string;
}) {
  const theme = useTheme();

  const billingInterval = getShortInterval(plan.billingInterval);
  const {features, description, hasMoreLink} = planContent;

  const describeId = `plan-details-${plan.id}`;
  const errorsStartingPrice = shouldShowEventPrice
    ? plan.planCategories.errors
      ? plan.planCategories.errors[1]?.onDemandPrice
      : null
    : null;
  const spansStartingPrice = shouldShowEventPrice
    ? plan.planCategories.spans
      ? plan.planCategories.spans[1]?.onDemandPrice
      : null
    : null;
  const showEventPriceWarning = errorsStartingPrice && spansStartingPrice;

  const onPlanSelect = () => {
    const data: PlanUpdateData = {plan: plan.id};
    if (shouldShowDefaultPayAsYouGo) {
      data.onDemandMaxSpend = isBizPlanFamily(plan)
        ? PAYG_BUSINESS_DEFAULT
        : PAYG_TEAM_DEFAULT;
      data.onDemandBudget = {
        budgetMode: OnDemandBudgetMode.SHARED,
        sharedMaxBudget: data.onDemandMaxSpend,
      };
    }
    onUpdate(data);
  };

  return (
    <PlanOption isSelected={isSelected} onClick={onPlanSelect}>
      <Row>
        <PlanIconContainer>
          {planIcon}
          {badge}
        </PlanIconContainer>
        <StyledRadio
          readOnly
          id={plan.id}
          value={planValue}
          checked={isSelected}
          onClick={onPlanSelect}
        />
      </Row>
      <div>
        <Title>{planName}</Title>
        <Description id={describeId} isSelected={isSelected}>
          {description}
        </Description>
      </div>
      <div>
        <Price>{price === 'Free' ? price : `$${price}`}</Price>
        {price !== 'Free' && <BillingInterval>{`/${billingInterval}`}</BillingInterval>}
      </div>
      <Separator />
      <FeatureList>
        {priorPlanName && (
          <PriorPlanItem>
            {tct('Everything in [priorPlanName], plus:', {
              priorPlanName,
            })}
          </PriorPlanItem>
        )}
        {features && highlightedFeatures ? (
          <Fragment>
            {Object.entries(features)
              .filter(([featureId, _]) => highlightedFeatures.includes(featureId))
              .map(([featureId, feature]) => (
                <FeatureItem key={featureId}>
                  <FeatureIconContainer>
                    <IconLightning size="sm" />
                  </FeatureIconContainer>
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
                </FeatureItem>
              ))}
            {Object.entries(features)
              .filter(([featureId, _]) => !highlightedFeatures.includes(featureId))
              .map(([featureId, feature]) => (
                <FeatureItem key={featureId}>
                  <FeatureIconContainer>
                    <IconCheckmark size="sm" color={theme.activeText as Color} />
                  </FeatureIconContainer>
                  {feature}
                </FeatureItem>
              ))}
            {hasMoreLink && (
              <MoreFeaturesLink
                color={theme.activeText as Color}
                iconSize="sm"
                isNewCheckout
              />
            )}
          </Fragment>
        ) : (
          <Fragment>
            {Object.entries(features).map(([featureId, feature]) => (
              <FeatureItem key={featureId}>
                <FeatureIconContainer>
                  <IconCheckmark size="sm" />
                </FeatureIconContainer>
                {feature}
              </FeatureItem>
            ))}
            {hasMoreLink && <MoreFeaturesLink iconSize="sm" isNewCheckout />}
          </Fragment>
        )}
      </FeatureList>
      {showEventPriceWarning && (
        <EventPriceWarning>
          <IconInfo size="xs" />
          <Tooltip
            title={tct(
              'Errors start at [errorsStartingPrice]/error and spans start at [spansStartingPrice]/span.',
              {
                errorsStartingPrice: displayUnitPrice({cents: errorsStartingPrice}),
                spansStartingPrice: displayUnitPrice({cents: spansStartingPrice}),
              }
            )}
          >
            {/* TODO(checkout v3): verify tooltip copy */}
            {tct('Excess usage for [errors] and [spans] costs more on [planName]', {
              errors: getPlanCategoryName({
                plan,
                category: DataCategory.ERRORS,
                title: true,
              }),
              spans: getPlanCategoryName({
                plan,
                category: DataCategory.SPANS,
                title: true,
              }),
              planName,
            })}
          </Tooltip>
        </EventPriceWarning>
      )}
    </PlanOption>
  );
}

export default PlanSelectCard;

const PlanOption = styled(Flex)<{isSelected?: boolean}>`
  padding: ${p => p.theme.space['2xl']};
  gap: ${p => p.theme.space.md};
  flex-direction: column;
  background: ${p => (p.isSelected ? `${p.theme.active}05` : p.theme.background)};
  color: ${p => (p.isSelected ? p.theme.activeText : p.theme.textColor)};
  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => (p.isSelected ? p.theme.active : p.theme.border)};
  cursor: pointer;
`;

const Row = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const PlanIconContainer = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
`;

const Title = styled('div')`
  font-size: ${p => p.theme.fontSize.lg};
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const Description = styled('div')<{isSelected?: boolean}>`
  color: ${p => (p.isSelected ? p.theme.activeText : p.theme.subText)};
`;

const Price = styled('span')`
  font-size: ${p => p.theme.fontSize['2xl']};
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const BillingInterval = styled('span')`
  font-size: ${p => p.theme.fontSize.lg};
`;

const Separator = styled('div')`
  border-top: 1px solid ${p => p.theme.innerBorder};
  margin: 0;
`;

const PriorPlanItem = styled('div')`
  color: ${p => p.theme.activeText};
`;

const FeatureItem = styled('div')`
  display: grid;
  grid-template-columns: min-content 1fr;
  align-items: start;
  color: ${p => p.theme.textColor};
`;

const FeatureIconContainer = styled('div')`
  margin-right: ${p => p.theme.space.md};
  display: flex;
  align-items: center;
`;

const StyledRadio = styled(Radio)`
  background: ${p => p.theme.background};
`;

const EventPriceWarning = styled('div')`
  display: flex;
  align-items: center;
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
  gap: ${p => p.theme.space.md};
  margin-top: ${p => p.theme.space['2xs']};

  > span {
    text-decoration: underline dotted;
    line-height: normal;
  }
`;

const FeatureList = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.xs};

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    flex-direction: row;
    flex-wrap: wrap;
    gap: ${p => p.theme.space.md};
  }
`;
