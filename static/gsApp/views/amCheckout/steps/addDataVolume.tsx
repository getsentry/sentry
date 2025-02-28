import {Component, Fragment} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import RangeSlider from 'sentry/components/forms/controls/rangeSlider';
import {Body, Header, Hovercard} from 'sentry/components/hovercard';
import ExternalLink from 'sentry/components/links/externalLink';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelFooter from 'sentry/components/panels/panelFooter';
import PanelItem from 'sentry/components/panels/panelItem';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {IconLightning, IconQuestion} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DataCategory} from 'sentry/types/core';

import {PlanTier} from 'getsentry/types';
import {formatReservedWithUnits} from 'getsentry/utils/billing';
import {getPlanCategoryName} from 'getsentry/utils/dataCategory';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';
import StepHeader from 'getsentry/views/amCheckout/steps/stepHeader';
import UnitTypeItem from 'getsentry/views/amCheckout/steps/unitTypeItem';
import {getDataCategoryTooltipText} from 'getsentry/views/amCheckout/steps/utils';
import type {StepProps} from 'getsentry/views/amCheckout/types';
import * as utils from 'getsentry/views/amCheckout/utils';

const ATTACHMENT_DIGITS = 2;

type Props = StepProps;

class AddDataVolume extends Component<Props> {
  componentDidUpdate(prevProps: Props) {
    const {isActive, organization} = this.props;

    // record when step is opened
    if (prevProps.isActive || !isActive) {
      return;
    }

    if (organization) {
      trackGetsentryAnalytics('checkout.data_sliders_viewed', {
        organization,
      });
    }
  }

  get title() {
    return t('Reserved Volumes');
  }

  handleChange(value: number, category: string) {
    const {organization, onUpdate, formData} = this.props;

    onUpdate({reserved: {...formData.reserved, [category]: value}});

    if (organization) {
      trackGetsentryAnalytics('checkout.data_slider_changed', {
        organization,
        data_type: category,
        quantity: value,
      });
    }
  }
  renderLearnMore() {
    return (
      <LearnMore>
        <FeatureBadge type="new" />
        <span>
          {tct(
            'Sentry will dynamically sample transaction volume at scale. [learnMore]',
            {
              learnMore: (
                <ExternalLink href="https://docs.sentry.io/product/data-management-settings/dynamic-sampling/">
                  {t('Learn more.')}
                </ExternalLink>
              ),
            }
          )}
        </span>
      </LearnMore>
    );
  }

  renderPerformanceUnits() {
    return (
      <PerformanceUnits>
        <PerformanceTag>
          <IconLightning size="sm" />
          {t('Sentry Performance')}
        </PerformanceTag>
        {t('Total Units')}
      </PerformanceUnits>
    );
  }

  renderHovercardBody() {
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

  renderPerformanceHovercard() {
    return (
      <StyledHovercard
        position="top"
        header={<div>{t('Performance Event Types')}</div>}
        body={this.renderHovercardBody()}
      >
        <IconContainer>
          <IconQuestion size="xs" color="subText" />
        </IconContainer>
      </StyledHovercard>
    );
  }

  renderBody = () => {
    const {organization, subscription, formData, activePlan, checkoutTier} = this.props;

    return (
      <PanelBody data-test-id={this.title}>
        {activePlan.checkoutCategories.map(category => {
          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          const allowedValues = activePlan.planCategories[category as DataCategory]!.map(
            (bucket: any) => bucket.events
          );

          const eventBucket = utils.getBucket({
            // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            events: formData.reserved[category],
            // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            buckets: activePlan.planCategories[category],
          });

          const min = allowedValues[0];
          const max = allowedValues.slice(-1)[0];

          const isMonitorCategory =
            category === DataCategory.MONITOR_SEATS || category === DataCategory.UPTIME;

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
          const sliderId = `slider-${category}`;

          return (
            <DataVolumeItem key={category} data-test-id={`${category}-volume-item`}>
              <div>
                {showPerformanceUnits && this.renderPerformanceUnits()}
                <SectionHeader>
                  <Title htmlFor={sliderId}>
                    <div>{getPlanCategoryName({plan: activePlan, category})}</div>
                    {showPerformanceUnits ? (
                      this.renderPerformanceHovercard()
                    ) : (
                      <QuestionTooltip
                        title={getDataCategoryTooltipText(checkoutTier, category)}
                        position="top"
                        size="xs"
                      />
                    )}
                  </Title>
                  <Events>
                    {
                      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                      formatReservedWithUnits(formData.reserved[category], category)
                    }
                  </Events>
                </SectionHeader>
                <Description>
                  <div>
                    {eventBucket.price !== 0 &&
                      // Monitors are an exception and do not render a price.
                      //
                      // NOTE(davidenwang): If we decide to change the reserved price of a monitor
                      // to zero we would no longer need this check, since the above check would
                      // handle this
                      !isMonitorCategory &&
                      tct('[unitPrice] per [category]', {
                        category:
                          category === DataCategory.ATTACHMENTS
                            ? 'GB'
                            : showPerformanceUnits
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
              {!isMonitorCategory && (
                <div>
                  <RangeSlider
                    showLabel={false}
                    name={category}
                    id={sliderId}
                    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                    value={formData.reserved[category]}
                    allowedValues={allowedValues}
                    formatLabel={() => null}
                    onChange={value => value && this.handleChange(value, category)}
                  />
                  <MinMax>
                    <div>{utils.getEventsWithUnit(min, category)}</div>
                    <div>{utils.getEventsWithUnit(max, category)}</div>
                  </MinMax>
                </div>
              )}
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
                this.renderLearnMore()}
            </DataVolumeItem>
          );
        })}
      </PanelBody>
    );
  };

  renderFooter = () => {
    const {stepNumber, onCompleteStep} = this.props;

    return (
      <StepFooter data-test-id={this.title}>
        <div>
          {tct('Need more data? Add On-Demand Budget, or [link:Contact Sales]', {
            link: <a href="mailto:sales@sentry.io" />,
          })}
        </div>
        <Button priority="primary" onClick={() => onCompleteStep(stepNumber)}>
          {t('Continue')}
        </Button>
      </StepFooter>
    );
  };

  render() {
    const {isActive, stepNumber, isCompleted, onEdit} = this.props;

    return (
      <Panel data-test-id="step-add-data-volume">
        <StepHeader
          canSkip
          title={this.title}
          isActive={isActive}
          stepNumber={stepNumber}
          isCompleted={isCompleted}
          onEdit={onEdit}
        />
        {isActive && this.renderBody()}
        {isActive && this.renderFooter()}
      </Panel>
    );
  }
}

export default AddDataVolume;

const LearnMore = styled('div')`
  display: grid;
  grid-template-columns: max-content auto;
  gap: ${space(1)};
  padding: ${space(1)};
  background: ${p => p.theme.backgroundSecondary};
  color: ${p => p.theme.subText};
  align-items: center;
`;

const StyledHovercard = styled(Hovercard)`
  width: 400px;

  ${Header} {
    color: ${p => p.theme.gray300};
    text-transform: uppercase;
    font-size: ${p => p.theme.fontSizeSmall};
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

const BaseRow = styled('div')`
  display: grid;
  grid-auto-flow: column;
  justify-content: space-between;
  align-items: center;
`;

const PerformanceUnits = styled(BaseRow)`
  text-transform: uppercase;
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: 600;
`;

const PerformanceTag = styled(BaseRow)`
  gap: ${space(0.5)};
  color: ${p => p.theme.purple300};
`;

// body
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
  font-size: ${p => p.theme.fontSizeExtraLarge};
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
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.gray300};
`;

const Events = styled('div')`
  font-size: ${p => p.theme.headerFontSize};
  margin: 0;
`;

const MinMax = styled(Description)`
  font-size: ${p => p.theme.fontSizeSmall};
`;

// footer
const StepFooter = styled(PanelFooter)`
  padding: ${space(2)};
  display: grid;
  grid-template-columns: auto max-content;
  gap: ${space(1)};
  align-items: center;
`;
