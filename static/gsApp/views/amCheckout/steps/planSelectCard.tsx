import {cloneElement, Fragment, isValidElement, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Tag} from 'sentry/components/core/badge/tag';
import {Flex} from 'sentry/components/core/layout';
import {Radio} from 'sentry/components/core/radio';
import {Tooltip} from 'sentry/components/core/tooltip';
import {IconCheckmark, IconInfo, IconLightning, IconWarning} from 'sentry/icons';
import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {t, tct} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import oxfordizeArray, {Oxfordize} from 'sentry/utils/oxfordizeArray';
import type {Color} from 'sentry/utils/theme';

import {PAYG_BUSINESS_DEFAULT, PAYG_TEAM_DEFAULT} from 'getsentry/constants';
import {OnDemandBudgetMode, type Plan} from 'getsentry/types';
import {isBizPlanFamily} from 'getsentry/utils/billing';
import {getSingularCategoryName, listDisplayNames} from 'getsentry/utils/dataCategory';
import MoreFeaturesLink from 'getsentry/views/amCheckout/moreFeaturesLink';
import type {PlanSelectRowProps} from 'getsentry/views/amCheckout/steps/planSelectRow';
import type {CheckoutFormData, PlanContent} from 'getsentry/views/amCheckout/types';
import {displayUnitPrice, getShortInterval} from 'getsentry/views/amCheckout/utils';

interface PlanSelectCardProps
  extends Omit<
    PlanSelectRowProps,
    'isFeaturesCheckmarked' | 'discountInfo' | 'planWarning' | 'priceHeader'
  > {
  /**
   * Missing features to highlight as a warning
   */
  missingFeatures: string[];
  /**
   * Icon to use for the plan
   */
  planIcon: React.ReactNode;
  /**
   * Plan content to use for missing feature upsells
   */
  upsellPlanContent: PlanContent;
  /**
   * Prior plan to compare against (ie. prior plan for Business is Team)
   */
  priorPlan?: Plan;
}

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
  shouldShowDefaultPayAsYouGo,
  planIcon,
  shouldShowEventPrice,
  priorPlan,
  missingFeatures,
  upsellPlanContent,
}: PlanSelectCardProps) {
  const theme = useTheme();

  const billingInterval = getShortInterval(plan.billingInterval);
  const {features, description, hasMoreLink} = planContent;

  const perUnitPriceDiffs: Partial<Record<DataCategory, number>> = useMemo(() => {
    if (!shouldShowEventPrice || !priorPlan) {
      return {};
    }

    return Object.entries(plan.planCategories).reduce(
      (acc, [category, eventBuckets]) => {
        const priorPlanEventBuckets = priorPlan.planCategories[category as DataCategory];
        const currentStartingPrice = eventBuckets[1]?.onDemandPrice ?? 0;
        const priorStartingPrice = priorPlanEventBuckets?.[1]?.onDemandPrice ?? 0;
        const perUnitPriceDiff = currentStartingPrice - priorStartingPrice;
        if (perUnitPriceDiff > 0) {
          acc[category as DataCategory] = perUnitPriceDiff;
        }
        return acc;
      },
      {} as Partial<Record<DataCategory, number>>
    );
  }, [shouldShowEventPrice, priorPlan, plan]);

  const showEventPriceWarning = useMemo(
    () => Object.values(perUnitPriceDiffs).length > 0,
    [perUnitPriceDiffs]
  );

  const onPlanSelect = () => {
    const data: Partial<CheckoutFormData> = {plan: plan.id};
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

  const adjustedPlanIcon = isValidElement(planIcon)
    ? cloneElement(planIcon, {size: 'md'} as SVGIconProps)
    : planIcon;

  return (
    <PlanOption
      data-test-id={`plan-option-${plan.id}`}
      isSelected={isSelected}
      onClick={onPlanSelect}
      direction="column"
      gap="md"
      padding="2xl"
    >
      <Row>
        <PlanIconContainer>
          {adjustedPlanIcon}
          {badge}
        </PlanIconContainer>
        <StyledRadio
          readOnly
          id={plan.id}
          aria-label={`${planName} plan`}
          value={planValue}
          checked={isSelected}
          onClick={onPlanSelect}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              onPlanSelect();
            }
          }}
        />
      </Row>
      <div>
        <Title>{planName}</Title>
        <Description isSelected={isSelected}>{description}</Description>
      </div>
      <div>
        <Price>{`$${price}`}</Price>
        <BillingInterval>{`/${billingInterval}`}</BillingInterval>
      </div>
      <Separator />
      <FeatureList>
        {priorPlan && (
          <PriorPlanItem>
            {tct('Everything in [priorPlanName], plus:', {
              priorPlanName: priorPlan.name,
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
                    <IconLightning size="sm" color={theme.activeText as Color} />
                  </FeatureIconContainer>
                  {
                    // only nudge user when they haven't selected the highlighted feature
                    highlightedFeatures.length === 1 && !isSelected ? (
                      <div>
                        <strong>{feature}</strong>
                        <HighlightedFeatureTag type="promotion">
                          {t('Looking for this?')}
                        </HighlightedFeatureTag>
                      </div>
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
            title={tct('Starting at [priceDiffs].', {
              priceDiffs: oxfordizeArray(
                Object.entries(perUnitPriceDiffs).map(([category, diff]) => {
                  const formattedDiff = displayUnitPrice({cents: diff});
                  const formattedCategory = getSingularCategoryName({
                    plan,
                    category: category as DataCategory,
                    capitalize: false,
                  });
                  return `+${formattedDiff} / ${formattedCategory}`;
                })
              ),
            })}
          >
            {/* TODO(checkout v3): verify tooltip copy */}
            {tct('Excess usage for [categories] costs more on [planName]', {
              categories: listDisplayNames({
                plan,
                categories: Object.keys(perUnitPriceDiffs) as DataCategory[],
                shouldTitleCase: true,
              }),
              planName,
            })}
          </Tooltip>
        </EventPriceWarning>
      )}
      {missingFeatures.length > 0 && (
        <Warning>
          <IconWarning size="xs" />
          <span>
            {tct('This plan does not include [missingFeatures]', {
              missingFeatures: (
                <Oxfordize>
                  {missingFeatures.map(feature => (
                    <b key={feature}>{upsellPlanContent.features[feature]}</b>
                  ))}
                </Oxfordize>
              ),
            })}
          </span>
        </Warning>
      )}
    </PlanOption>
  );
}

export default PlanSelectCard;

const PlanOption = styled(Flex)<{isSelected?: boolean}>`
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
  color: ${p => p.theme.subText};
`;

const FeatureIconContainer = styled('div')`
  margin-right: ${p => p.theme.space.md};
  display: flex;
  align-items: center;
`;

const HighlightedFeatureTag = styled(Tag)`
  margin-left: ${p => p.theme.space.sm};
`;

const StyledRadio = styled(Radio)`
  background: ${p => p.theme.background};
`;

const Warning = styled('div')`
  display: flex;
  align-items: flex-start;
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
  gap: ${p => p.theme.space.md};
  margin-top: auto;
  line-height: normal;

  > svg {
    margin-top: ${p => p.theme.space['2xs']};
  }
`;

const EventPriceWarning = styled(Warning)`
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
