import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';
import RangeSlider from 'sentry/components/forms/controls/rangeSlider';
import {Body, Header, Hovercard} from 'sentry/components/hovercard';
import PanelItem from 'sentry/components/panels/panelItem';
import {DATA_CATEGORY_INFO} from 'sentry/constants';
import {IconLightning, IconQuestion} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {DataCategory, DataCategoryExact} from 'sentry/types/core';
import {defined} from 'sentry/utils';

import {PlanTier} from 'getsentry/types';
import {formatReservedWithUnits} from 'getsentry/utils/billing';
import {
  getPlanCategoryName,
  getSingularCategoryName,
  isByteCategory,
} from 'getsentry/utils/dataCategory';
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
  formData,
  subscription,
  onReservedChange,
}: Pick<
  StepProps,
  | 'activePlan'
  | 'checkoutTier'
  | 'organization'
  | 'onUpdate'
  | 'formData'
  | 'subscription'
> & {
  onReservedChange: (value: number, category: DataCategory) => void;
}) {
  const renderPerformanceUnitDecoration = () => (
    <PerformanceUnits>
      <PerformanceTag>
        <IconLightning size="sm" />
        {t('Sentry Performance')}
      </PerformanceTag>
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
            <DataVolumeItem key={category} data-test-id={`${category}-volume-item`}>
              <CategoryContainer>
                <Flex direction="column">
                  {showPerformanceUnits && renderPerformanceUnitDecoration()}
                  <Title htmlFor={sliderId}>
                    <div>{getPlanCategoryName({plan: activePlan, category})}</div>
                  </Title>
                  {eventBucket.price !== 0 && (
                    <Description>
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
                        ? onReservedChange(value, category)
                        : undefined
                    }
                  />
                  <MinMax>
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
    border-bottom: 1px solid ${p => p.theme.innerBorder};
  }
`;

const DataVolumeItem = styled(PanelItem)`
  display: grid;
  grid-auto-flow: row;
  gap: ${p => p.theme.space['2xl']};
  font-weight: normal;
  width: 100%;
  margin: 0;
  padding-left: 0;
  padding-right: 0;
`;

const Title = styled('label')`
  display: flex;
  gap: ${p => p.theme.space.xs};
  align-items: center;
  margin-bottom: 0px;
  font-weight: ${p => p.theme.fontWeight.bold};
  font-size: ${p => p.theme.fontSize.md};
`;

const SpaceBetweenGrid = styled('div')`
  display: grid;
  grid-template-columns: repeat(2, auto);
  justify-content: space-between;
`;

const Description = styled(SpaceBetweenGrid)`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
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
