import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';
import RangeSlider from 'sentry/components/forms/controls/rangeSlider';
import {Body, Header, Hovercard} from 'sentry/components/hovercard';
import PanelItem from 'sentry/components/panels/panelItem';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {DATA_CATEGORY_INFO} from 'sentry/constants';
import {IconLightning, IconQuestion} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {DataCategory, DataCategoryExact} from 'sentry/types/core';
import {defined} from 'sentry/utils';

import {PlanTier} from 'getsentry/types';
import {formatReservedWithUnits} from 'getsentry/utils/billing';
import {
  getCategoryInfoFromPlural,
  getPlanCategoryName,
  getSingularCategoryName,
  isByteCategory,
} from 'getsentry/utils/dataCategory';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';
import UnitTypeItem from 'getsentry/views/amCheckout/components/unitTypeItem';
import type {StepProps} from 'getsentry/views/amCheckout/types';
import * as utils from 'getsentry/views/amCheckout/utils';

const ATTACHMENT_DIGITS = 2;

function renderHovercardBody() {
  return (
    <Fragment>
      <UnitTypeItem
        unitName={t('Transactions')}
        description={t(
          'Transactions are sent when your service receives a request and sends a response.'
        )}
        weight="1.0"
      />
      <UnitTypeItem
        unitName={t('Transactions with Profiling')}
        description={t(
          'Transactions with Profiling provide the deepest level of visibility for your apps.'
        )}
        weight="1.3"
      />
    </Fragment>
  );
}

export function renderPerformanceHovercard() {
  return (
    <StyledHovercard
      position="top"
      header={<div>{t('Performance Event Types')}</div>}
      body={renderHovercardBody()}
    >
      <IconContainer>
        <IconQuestion size="xs" color="subText" />
      </IconContainer>
    </StyledHovercard>
  );
}

function VolumeSliders({
  checkoutTier,
  activePlan,
  organization,
  onUpdate,
  formData,
  subscription,
  isLegacy,
  isNewCheckout,
  onReservedChange,
}: Pick<
  StepProps,
  | 'activePlan'
  | 'checkoutTier'
  | 'organization'
  | 'onUpdate'
  | 'formData'
  | 'subscription'
  | 'isNewCheckout'
> & {
  isLegacy: boolean;
  onReservedChange?: (value: number, category: DataCategory) => void;
}) {
  // TODO(checkout v3): Remove this once we've GA'd, the changes are handled in the parent component
  const handleReservedChange = (value: number, category: DataCategory) => {
    onUpdate({reserved: {...formData.reserved, [category]: value}});

    if (organization) {
      trackGetsentryAnalytics('checkout.data_slider_changed', {
        organization,
        data_type: category,
        quantity: value,
      });
    }
  };

  const renderPerformanceUnitDecoration = () => (
    <PerformanceUnits>
      <PerformanceTag>
        <IconLightning size="sm" />
        {t('Sentry Performance')}
      </PerformanceTag>
      {!isNewCheckout && t('Total Units')}
    </PerformanceUnits>
  );

  return (
    <SlidersContainer>
      {activePlan.checkoutCategories
        .filter(
          // only show sliders for checkout categories with more than 1 bucket
          category => (activePlan.planCategories[category]?.length ?? 0) > 1
        )
        .map(category => {
          const allowedValues = activePlan.planCategories[category]?.map(
            (bucket: any) => bucket.events
          );

          if (!allowedValues) {
            return null;
          }

          const categoryInfo = getCategoryInfoFromPlural(category);
          const eventBucket = utils.getBucket({
            events: formData.reserved[category],
            buckets: activePlan.planCategories[category],
          });

          const min = allowedValues[0];
          const max = allowedValues.slice(-1)[0];

          const billingInterval = utils.getShortInterval(activePlan.billingInterval);
          const price = utils.displayPrice({cents: eventBucket.price});
          const unitPrice = utils.displayUnitPrice({
            cents: eventBucket.unitPrice || 0,
            ...(category === DataCategory.ATTACHMENTS
              ? {
                  minDigits: ATTACHMENT_DIGITS,
                  maxDigits: ATTACHMENT_DIGITS,
                }
              : {}),
          });

          const sliderId = `slider-${category}`;

          // pre-AM3 specific behavior
          const showPerformanceUnits =
            checkoutTier === PlanTier.AM2 &&
            organization?.features?.includes('profiling-billing') &&
            category === DataCategory.TRANSACTIONS;

          // TODO: Remove after profiling launch
          const showTransactionsDisclaimer =
            !showPerformanceUnits &&
            category === DataCategory.TRANSACTIONS &&
            checkoutTier === PlanTier.AM2 &&
            subscription.planTier === PlanTier.AM1 &&
            subscription.planDetails.name === activePlan.name &&
            subscription.billingInterval === activePlan.billingInterval &&
            (subscription.categories.transactions?.reserved ?? 0) > 5_000_000;

          const isIncluded = eventBucket.price === 0;

          return (
            <DataVolumeItem
              key={category}
              data-test-id={`${category}-volume-item`}
              isNewCheckout={!!isNewCheckout}
            >
              {isNewCheckout ? (
                <CategoryContainer>
                  <Flex direction="column">
                    {showPerformanceUnits && renderPerformanceUnitDecoration()}
                    <Title htmlFor={sliderId} isNewCheckout={!!isNewCheckout}>
                      <div>{getPlanCategoryName({plan: activePlan, category})}</div>
                    </Title>
                    {eventBucket.price !== 0 && (
                      <Description isNewCheckout={!!isNewCheckout}>
                        <div>
                          {tct('[unitPrice]/[category]', {
                            category:
                              category ===
                              DATA_CATEGORY_INFO[DataCategoryExact.ATTACHMENT].plural
                                ? 'GB'
                                : getSingularCategoryName({
                                    plan: activePlan,
                                    category,
                                    capitalize: false,
                                  }),
                            unitPrice,
                          })}
                        </div>
                      </Description>
                    )}
                  </Flex>
                  <div>
                    <SpaceBetweenGrid>
                      <VolumeAmount>
                        {formatReservedWithUnits(
                          formData.reserved[category] ?? null,
                          category,
                          {
                            isAbbreviated: !isByteCategory(category),
                          }
                        )}
                      </VolumeAmount>
                      <div>
                        <Price isIncluded={isIncluded}>
                          {isIncluded ? t('Included') : price}
                        </Price>
                        {!isIncluded && (
                          <BillingInterval>/{billingInterval}</BillingInterval>
                        )}
                      </div>
                    </SpaceBetweenGrid>
                    <RangeSlider
                      showLabel={false}
                      name={category}
                      id={sliderId}
                      aria-label={
                        isByteCategory(category)
                          ? t(
                              'Reserved volume for %s (in gigabytes)',
                              getPlanCategoryName({plan: activePlan, category})
                            )
                          : t(
                              'Reserved volume for %s',
                              getPlanCategoryName({plan: activePlan, category})
                            )
                      }
                      value={formData.reserved[category] ?? ''}
                      allowedValues={allowedValues}
                      onChange={value =>
                        defined(value) && typeof value === 'number'
                          ? onReservedChange
                            ? onReservedChange(value, category)
                            : handleReservedChange(value, category)
                          : undefined
                      }
                    />
                    <MinMax isNewCheckout={!!isNewCheckout}>
                      <div>
                        {tct('[min] included', {
                          min: formatReservedWithUnits(min, category),
                        })}
                      </div>
                      <div>
                        {formatReservedWithUnits(max, category, {
                          isAbbreviated: !isByteCategory(category),
                        })}
                      </div>
                    </MinMax>
                  </div>
                  {showTransactionsDisclaimer && (
                    <span>
                      {t(
                        'We updated your event quota to make sure you get the best cost per transaction. Feel free to adjust as needed.'
                      )}
                    </span>
                  )}
                </CategoryContainer>
              ) : (
                <Fragment>
                  <div>
                    {showPerformanceUnits && renderPerformanceUnitDecoration()}
                    <SectionHeader>
                      <Title htmlFor={sliderId} isNewCheckout={!!isNewCheckout}>
                        <div>{getPlanCategoryName({plan: activePlan, category})}</div>
                        {showPerformanceUnits
                          ? renderPerformanceHovercard()
                          : categoryInfo?.checkoutTooltip && (
                              <QuestionTooltip
                                title={categoryInfo.checkoutTooltip}
                                position="top"
                                size="xs"
                              />
                            )}
                      </Title>
                      <Events isLegacy={isLegacy}>
                        {formatReservedWithUnits(
                          formData.reserved[category] ?? null,
                          category
                        )}
                      </Events>
                    </SectionHeader>
                    <Description isNewCheckout={!!isNewCheckout}>
                      <div>
                        {eventBucket.price !== 0 &&
                          tct('[unitPrice] per [category]', {
                            category: isByteCategory(category)
                              ? 'GB'
                              : category ===
                                    DATA_CATEGORY_INFO[DataCategoryExact.SPAN].plural ||
                                  showPerformanceUnits
                                ? 'unit'
                                : 'event',
                            unitPrice,
                          })}
                      </div>
                      <div>
                        {eventBucket.price === 0
                          ? t('included')
                          : `${price}/${billingInterval}`}
                      </div>
                    </Description>
                  </div>
                  <div>
                    <RangeSlider
                      showLabel={false}
                      name={category}
                      id={sliderId}
                      value={formData.reserved[category] ?? ''}
                      allowedValues={allowedValues}
                      formatLabel={() => null}
                      onChange={value => value && handleReservedChange(value, category)}
                    />
                    <MinMax isNewCheckout={!!isNewCheckout}>
                      <div>
                        {formatReservedWithUnits(min, category, {
                          isAbbreviated: !isByteCategory(category),
                        })}
                      </div>
                      <div>
                        {formatReservedWithUnits(max, category, {
                          isAbbreviated: !isByteCategory(category),
                        })}
                      </div>
                    </MinMax>
                  </div>
                  {showTransactionsDisclaimer && (
                    <span>
                      {t(
                        'We updated your event quota to make sure you get the best cost per transaction. Feel free to adjust as needed.'
                      )}
                    </span>
                  )}
                </Fragment>
              )}
            </DataVolumeItem>
          );
        })}
    </SlidersContainer>
  );
}

export default VolumeSliders;

const SlidersContainer = styled('div')`
  padding: ${p => p.theme.space.sm} ${p => p.theme.space.xl};
  > :not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
  }
`;

const DataVolumeItem = styled(PanelItem)<{isNewCheckout: boolean}>`
  display: grid;
  grid-auto-flow: row;
  gap: ${p => p.theme.space['2xl']};
  font-weight: normal;
  width: 100%;
  margin: 0;

  ${p =>
    p.isNewCheckout &&
    css`
      padding-left: 0;
      padding-right: 0;
    `}
`;

const SectionHeader = styled('div')`
  display: grid;
  grid-template-columns: repeat(2, auto);
  justify-content: space-between;
  color: ${p => p.theme.tokens.content.primary};
  font-size: ${p => p.theme.fontSize.xl};
`;

const Title = styled('label')<{isNewCheckout: boolean}>`
  display: flex;
  gap: ${p => p.theme.space.xs};
  align-items: center;
  margin-bottom: 0px;
  font-weight: ${p => p.theme.fontWeight.bold};
  font-size: ${p => (p.isNewCheckout ? p.theme.fontSize.md : p.theme.fontSize.xl)};
`;

const SpaceBetweenGrid = styled('div')`
  display: grid;
  grid-template-columns: repeat(2, auto);
  justify-content: space-between;
`;

const Description = styled(SpaceBetweenGrid)<{isNewCheckout: boolean}>`
  font-size: ${p => (p.isNewCheckout ? p.theme.fontSize.sm : p.theme.fontSize.md)};
  color: ${p => p.theme.subText};
`;

const Events = styled('div')<{isLegacy: boolean}>`
  font-size: ${p => p.theme.fontSize.xl};
  margin: 0;
  font-weight: ${p => (p.isLegacy ? 'normal' : '600')};
`;

const MinMax = styled(Description)`
  font-size: ${p => p.theme.fontSize.sm};
`;

const BaseRow = styled('div')`
  display: grid;
  grid-auto-flow: column;
  justify-content: space-between;
  align-items: center;
`;

const StyledHovercard = styled(Hovercard)`
  width: 400px;

  ${Header} {
    color: ${p => p.theme.subText};
    text-transform: uppercase;
    font-size: ${p => p.theme.fontSize.sm};
    border-radius: 6px 6px 0px 0px;
    padding: ${p => p.theme.space.xl};
  }
  ${Body} {
    padding: 0px;
  }

  @media (max-width: ${p => p.theme.breakpoints.xs}) {
    width: 100%;
  }
`;

const IconContainer = styled('span')`
  svg {
    transition: 120ms opacity;
    opacity: 0.6;

    &:hover {
      opacity: 1;
    }
  }
`;

const PerformanceUnits = styled(BaseRow)`
  text-transform: uppercase;
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: 600;
`;

const PerformanceTag = styled(BaseRow)`
  gap: ${p => p.theme.space.xs};
  color: ${p => p.theme.purple300};
`;

const VolumeAmount = styled('div')`
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const Price = styled('span')<{isIncluded: boolean}>`
  font-size: ${p => p.theme.fontSize.lg};
  font-weight: ${p =>
    p.isIncluded ? p.theme.fontWeight.normal : p.theme.fontWeight.bold};
`;

const BillingInterval = styled('span')`
  font-size: ${p => p.theme.fontSize.md};
`;

const CategoryContainer = styled('div')`
  display: grid;
  grid-template-columns: 1fr 3fr;
  gap: ${p => p.theme.space['2xl']};

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    grid-template-columns: 1fr;
  }
`;
