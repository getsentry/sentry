import {Fragment} from 'react';
import styled from '@emotion/styled';

import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import RangeSlider from 'sentry/components/forms/controls/rangeSlider';
import {Body, Header, Hovercard} from 'sentry/components/hovercard';
import ExternalLink from 'sentry/components/links/externalLink';
import PanelItem from 'sentry/components/panels/panelItem';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {DATA_CATEGORY_INFO} from 'sentry/constants';
import {IconLightning, IconQuestion} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DataCategory, DataCategoryExact} from 'sentry/types/core';

import {PlanTier} from 'getsentry/types';
import {formatReservedWithUnits} from 'getsentry/utils/billing';
import {
  getCategoryInfoFromPlural,
  getPlanCategoryName,
} from 'getsentry/utils/dataCategory';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';
import UnitTypeItem from 'getsentry/views/amCheckout/steps/unitTypeItem';
import type {StepProps} from 'getsentry/views/amCheckout/types';
import * as utils from 'getsentry/views/amCheckout/utils';

const ATTACHMENT_DIGITS = 2;

function VolumeSliders({
  checkoutTier,
  activePlan,
  organization,
  onUpdate,
  formData,
  subscription,
  isLegacy,
}: Pick<
  StepProps,
  | 'activePlan'
  | 'checkoutTier'
  | 'organization'
  | 'onUpdate'
  | 'formData'
  | 'subscription'
> & {
  isLegacy: boolean;
}) {
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
      {t('Total Units')}
    </PerformanceUnits>
  );

  const renderHovercardBody = () => (
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

  const renderPerformanceHovercard = () => (
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

  const renderLearnMore = () => (
    <LearnMore>
      <FeatureBadge type="new" />
      <span>
        {tct('Sentry will dynamically sample transaction volume at scale. [learnMore]', {
          learnMore: (
            <ExternalLink href="https://docs.sentry.io/product/data-management-settings/dynamic-sampling/">
              {t('Learn more.')}
            </ExternalLink>
          ),
        })}
      </span>
    </LearnMore>
  );

  return (
    <Fragment>
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

          return (
            <DataVolumeItem key={category} data-test-id={`${category}-volume-item`}>
              <div>
                {showPerformanceUnits && renderPerformanceUnitDecoration()}
                <SectionHeader>
                  <Title htmlFor={sliderId}>
                    <div>{getPlanCategoryName({plan: activePlan, category})}</div>
                    {showPerformanceUnits
                      ? renderPerformanceHovercard()
                      : categoryInfo?.reservedVolumeTooltip && (
                          <QuestionTooltip
                            title={categoryInfo.reservedVolumeTooltip}
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
                <Description>
                  <div>
                    {eventBucket.price !== 0 &&
                      tct('[unitPrice] per [category]', {
                        category:
                          category ===
                          DATA_CATEGORY_INFO[DataCategoryExact.ATTACHMENT].plural
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
                <MinMax>
                  <div>{utils.getEventsWithUnit(min, category)}</div>
                  <div>{utils.getEventsWithUnit(max, category)}</div>
                </MinMax>
              </div>
              {showTransactionsDisclaimer && (
                <span>
                  {t(
                    'We updated your event quota to make sure you get the best cost per transaction. Feel free to adjust as needed.'
                  )}
                </span>
              )}
              {/* TODO: Remove after profiling launch */}
              {!showPerformanceUnits &&
                category === DataCategory.TRANSACTIONS &&
                activePlan.features.includes('dynamic-sampling') &&
                renderLearnMore()}
            </DataVolumeItem>
          );
        })}
    </Fragment>
  );
}

export default VolumeSliders;

const DataVolumeItem = styled(PanelItem)`
  display: grid;
  grid-auto-flow: row;
  gap: ${space(3)};
  font-weight: normal;
  width: 100%;
  margin: 0;
  border-bottom: 1px solid ${p => p.theme.innerBorder};
`;

const SectionHeader = styled('div')`
  display: grid;
  grid-template-columns: repeat(2, auto);
  justify-content: space-between;
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.fontSize.xl};
`;

const Title = styled('label')`
  display: grid;
  grid-auto-flow: column;
  gap: ${space(0.5)};
  align-items: center;
  margin-bottom: 0px;
  font-weight: 600;
`;

const Description = styled('div')`
  display: grid;
  grid-template-columns: repeat(2, auto);
  justify-content: space-between;
  font-size: ${p => p.theme.fontSize.md};
  color: ${p => p.theme.subText};
`;

const Events = styled('div')<{isLegacy: boolean}>`
  font-size: ${p => p.theme.headerFontSize};
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
    padding: ${space(2)};
  }
  ${Body} {
    padding: 0px;
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
  gap: ${space(0.5)};
  color: ${p => p.theme.purple300};
`;

const LearnMore = styled('div')`
  display: grid;
  grid-template-columns: max-content auto;
  gap: ${space(1)};
  padding: ${space(1)};
  background: ${p => p.theme.backgroundSecondary};
  color: ${p => p.theme.subText};
  align-items: center;
`;
