import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {RangeSlider} from 'sentry/components/forms/controls/rangeSlider';
import {Body, Header, Hovercard} from 'sentry/components/hovercard';
import {PanelItem} from 'sentry/components/panels/panelItem';
import {DATA_CATEGORY_INFO} from 'sentry/constants';
import {IconLightning, IconQuestion} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {DataCategory, DataCategoryExact} from 'sentry/types/core';
import {defined} from 'sentry/utils/defined';

import {formatReservedWithUnits} from 'getsentry/utils/billing';
import {
  getCategoryInfoFromPlural,
  getPlanCategoryName,
  getSingularCategoryName,
  isByteCategory,
  isReservedBudgetCategory,
} from 'getsentry/utils/dataCategory';
import {UnitTypeItem} from 'getsentry/views/amCheckout/components/unitTypeItem';
import type {StepProps} from 'getsentry/views/amCheckout/types';
import * as utils from 'getsentry/views/amCheckout/utils';

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

function PerformanceUnitDecoration() {
  return (
    <Grid flow="column" justify="between" align="center">
      <Flex gap="xs">
        <IconLightning size="sm" />
        <Text as="span" size="sm" variant="accent" uppercase bold>
          {t('Sentry Performance')}
        </Text>
      </Flex>
    </Grid>
  );
}

export function PerformanceHovercard() {
  return (
    <StyledHovercard
      position="top"
      header={<div>{t('Performance Event Types')}</div>}
      body={renderHovercardBody()}
    >
      <IconContainer>
        <IconQuestion size="xs" variant="muted" />
      </IconContainer>
    </StyledHovercard>
  );
}

export function VolumeSliders({
  currentSliderValues,
  activePlan,
  organization,
  onReservedChange,
}: Pick<StepProps, 'activePlan' | 'organization' | 'onUpdate'> & {
  currentSliderValues: Partial<Record<DataCategory, number>>;
  onReservedChange: (value: number, category: DataCategory) => void;
}) {
  return (
    <SlidersContainer>
      {activePlan.categories
        .filter(
          // Show sliders for categories with a multi-bucket reserved-volume
          // schedule, excluding those configured via a reserved budget (e.g.
          // Seer), which are set through the budget rather than a volume slider.
          category =>
            (activePlan.planCategories[category]?.length ?? 0) > 1 &&
            !isReservedBudgetCategory(category, activePlan)
        )
        .map(category => {
          const allowedValues = activePlan.planCategories[category]?.map(
            bucket => bucket.events
          );

          if (!allowedValues) {
            return null;
          }

          const eventBucket = utils.getBucket({
            events: currentSliderValues[category],
            buckets: activePlan.planCategories[category],
          });

          const categoryInfo = getCategoryInfoFromPlural(category);

          const min = allowedValues[0]!;
          const max = allowedValues.slice(-1)[0]!;

          const billingInterval = utils.getShortInterval(activePlan.billingInterval);
          const price = utils.displayPrice({cents: eventBucket.price});
          const unitPrice = utils.displayUnitPrice({
            cents: eventBucket.unitPrice || 0,
            minDigits: categoryInfo?.formatting.priceFormatting.minFractionDigits,
            maxDigits: categoryInfo?.formatting.priceFormatting.maxFractionDigits,
          });

          const sliderId = `slider-${category}`;

          // AM2-specific behavior: AM2 rebrands transactions as "performance
          // units". AM2 is the only tier that bills both transactions and
          // continuous profiling (AM1 has no profiling; AM3 replaced
          // transactions with spans), so this pair of data categories
          // identifies it without branching on the tier id.
          const isAm2Plan =
            activePlan.categories.includes(DataCategory.TRANSACTIONS) &&
            activePlan.categories.includes(DataCategory.PROFILE_DURATION);
          const showPerformanceUnits =
            isAm2Plan &&
            organization?.features?.includes('profiling-billing') &&
            category === DataCategory.TRANSACTIONS;

          const isIncluded = eventBucket.price === 0;

          return (
            <DataVolumeItem key={category} data-test-id={`${category}-volume-item`}>
              <Grid columns={{zero: '1fr', xl: '1fr 3fr'}} gap="2xl">
                <Stack>
                  {showPerformanceUnits && <PerformanceUnitDecoration />}
                  <Flex as="label" htmlFor={sliderId} gap="xs" align="center">
                    <Text as="span" size="md" bold>
                      {getPlanCategoryName({plan: activePlan, category})}
                    </Text>
                  </Flex>
                  {eventBucket.price !== 0 && (
                    <Text as="div" size="sm" variant="muted">
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
                    </Text>
                  )}
                </Stack>
                <div>
                  <Grid columns="repeat(2, auto)" justify="between">
                    <Text as="div" bold>
                      {formatReservedWithUnits(
                        currentSliderValues[category] ?? null,
                        category,
                        {
                          isAbbreviated: !isByteCategory(category),
                        }
                      )}
                    </Text>
                    <div>
                      <Text as="span" size="lg" bold={!isIncluded}>
                        {isIncluded ? t('Included') : price}
                      </Text>
                      {!isIncluded && (
                        <Text as="span" size="md">
                          /{billingInterval}
                        </Text>
                      )}
                    </div>
                  </Grid>
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
                    value={currentSliderValues[category] ?? ''}
                    allowedValues={allowedValues}
                    onChange={value =>
                      defined(value) && typeof value === 'number'
                        ? onReservedChange(value, category)
                        : undefined
                    }
                  />
                  <Grid columns="repeat(2, auto)" justify="between">
                    <Text as="div" size="sm">
                      {tct('[min] included', {
                        min: formatReservedWithUnits(min, category),
                      })}
                    </Text>
                    <Text as="div" size="sm">
                      {formatReservedWithUnits(max, category, {
                        isAbbreviated: !isByteCategory(category),
                      })}
                    </Text>
                  </Grid>
                </div>
              </Grid>
            </DataVolumeItem>
          );
        })}
    </SlidersContainer>
  );
}

const SlidersContainer = styled('div')`
  padding: ${p => p.theme.space.sm} ${p => p.theme.space.xl};
  > :not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
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

const StyledHovercard = styled(Hovercard)`
  width: 400px;

  ${Header} {
    color: ${p => p.theme.tokens.content.secondary};
    text-transform: uppercase;
    font-size: ${p => p.theme.font.size.sm};
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
