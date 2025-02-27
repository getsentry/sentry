import {Component} from 'react';
import styled from '@emotion/styled';

import Tag from 'sentry/components/badge/tag';
import {Button} from 'sentry/components/button';
import RangeSlider from 'sentry/components/forms/controls/rangeSlider';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelFooter from 'sentry/components/panels/panelFooter';
import PanelItem from 'sentry/components/panels/panelItem';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {DATA_CATEGORY_INFO} from 'sentry/constants';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DataCategoryExact} from 'sentry/types/core';

import {OnDemandBudgetMode, type OnDemandBudgets} from 'getsentry/types';
import {
  formatReservedWithUnits,
  isBizPlanFamily,
  isDeveloperPlan,
} from 'getsentry/utils/billing';
import {getPlanCategoryName} from 'getsentry/utils/dataCategory';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';
import StepHeader from 'getsentry/views/amCheckout/steps/stepHeader';
import {getDataCategoryTooltipText} from 'getsentry/views/amCheckout/steps/utils';
import type {StepProps} from 'getsentry/views/amCheckout/types';
import * as utils from 'getsentry/views/amCheckout/utils';
import PayAsYouGoBudgetEdit from 'getsentry/views/onDemandBudgets/payAsYouGoBudgetEdit';
import {getTotalBudget} from 'getsentry/views/onDemandBudgets/utils';

const ATTACHMENT_DIGITS = 2;
const PAYG_BUSINESS_DEFAULT = 30000;
const PAYG_TEAM_DEFAULT = 10000;

type Props = StepProps;

type State = {
  // Once the PAYG budget is updated, we no longer suggest a new default PAYG value
  isUpdated: boolean;
};

class SetBudgetAndReserves extends Component<Props, State> {
  state: State = {isUpdated: false};

  componentDidUpdate(prevProps: Props) {
    const {isActive, organization, subscription, activePlan} = this.props;

    // record when step is opened
    if (prevProps.isActive || !isActive) {
      return;
    }

    const hasPartnerMigrationFeature = organization?.features.includes(
      'partner-billing-migration'
    );

    // set default budget for new customers for the first time they complete plan selection
    if (
      (isDeveloperPlan(subscription.planDetails) || hasPartnerMigrationFeature) &&
      !this.state.isUpdated &&
      isActive
    ) {
      // Default shared budgets are hardcoded vs being a multiple of the plan's base price
      const defaultBudget = isBizPlanFamily(activePlan)
        ? PAYG_BUSINESS_DEFAULT
        : PAYG_TEAM_DEFAULT;
      this.handleBudgetChange({
        budgetMode: OnDemandBudgetMode.SHARED,
        sharedMaxBudget: defaultBudget,
      });
      this.setState({isUpdated: true});
    }

    organization &&
      trackGetsentryAnalytics('checkout.data_sliders_viewed', {
        organization,
      });
  }

  get title() {
    return t('Set Your Pay-as-you-go Budget');
  }

  handleBudgetChange(value: OnDemandBudgets) {
    const {organization, subscription, onUpdate, formData} = this.props;

    // right now value is always a SharedOnDemandBudget but re-defining it here makes TS happy
    const budget = {
      budgetMode: value.budgetMode,
      sharedMaxBudget: getTotalBudget(value),
    };

    onUpdate({
      onDemandBudget: value,
      onDemandMaxSpend: budget.sharedMaxBudget,
    });

    organization &&
      trackGetsentryAnalytics('checkout.payg_changed', {
        organization,
        subscription,
        plan: formData.plan,
        cents: budget.sharedMaxBudget || 0,
      });
  }

  handleReservedChange(value: number, category: string) {
    const {organization, onUpdate, formData} = this.props;

    onUpdate({reserved: {...formData.reserved, [category]: value}});

    organization &&
      trackGetsentryAnalytics('checkout.data_slider_changed', {
        organization,
        data_type: category,
        quantity: value,
      });
  }

  renderBody = () => {
    const {formData, activePlan, checkoutTier} = this.props;

    const budgetIsNotUnset =
      typeof formData.onDemandMaxSpend === 'number' && !isNaN(formData.onDemandMaxSpend);

    const paygBudget: OnDemandBudgets =
      budgetIsNotUnset && formData.onDemandBudget
        ? formData.onDemandBudget.budgetMode === OnDemandBudgetMode.PER_CATEGORY
          ? {
              budgetMode: OnDemandBudgetMode.SHARED,
              sharedMaxBudget: getTotalBudget(formData.onDemandBudget),
            }
          : formData.onDemandBudget
        : {budgetMode: OnDemandBudgetMode.SHARED, sharedMaxBudget: 0};

    return (
      <PanelBody data-test-id={this.title}>
        <PayAsYouGoBudgetEdit
          payAsYouGoBudget={paygBudget}
          setPayAsYouGoBudget={value => this.handleBudgetChange(value)}
        />
        <RowWithTag>
          <SectionHeader>
            <LargeTitle>
              {t('Set Reserved Volumes')}
              <OptionalText>{t(' (optional)')}</OptionalText>
              <QuestionTooltip
                title={t('Prepay for usage by reserving volumes and save up to 20%')}
                position="bottom"
                size="sm"
              />
            </LargeTitle>
          </SectionHeader>
          <Tag type="promotion">{t('Plan ahead and save 20%')}</Tag>
        </RowWithTag>
        {activePlan.checkoutCategories
          .filter(
            // only show sliders for checkout categories with more than 1 bucket
            // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            category => activePlan.planCategories[category].length > 1
          )
          .map(category => {
            // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            const allowedValues = activePlan.planCategories[category].map(
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

            const billingInterval = utils.getShortInterval(activePlan.billingInterval);
            const price = utils.displayPrice({cents: eventBucket.price});
            const unitPrice = utils.displayUnitPrice({
              cents: eventBucket.unitPrice || 0,
              ...(category === DATA_CATEGORY_INFO[DataCategoryExact.ATTACHMENT].plural
                ? {
                    minDigits: ATTACHMENT_DIGITS,
                    maxDigits: ATTACHMENT_DIGITS,
                  }
                : {}),
            });

            const sliderId = `slider-${category}`;

            return (
              <DataVolumeItem key={category} data-test-id={`${category}-volume-item`}>
                <div>
                  <SectionHeader>
                    <Title htmlFor={sliderId}>
                      <div>{getPlanCategoryName({plan: activePlan, category})}</div>
                      <QuestionTooltip
                        title={getDataCategoryTooltipText(checkoutTier, category)}
                        position="top"
                        size="xs"
                      />
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
                        tct('[unitPrice] per [category]', {
                          category:
                            category ===
                            DATA_CATEGORY_INFO[DataCategoryExact.ATTACHMENT].plural
                              ? 'GB'
                              : category ===
                                  DATA_CATEGORY_INFO[DataCategoryExact.SPAN].plural
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
                    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                    value={formData.reserved[category]}
                    allowedValues={allowedValues}
                    formatLabel={() => null}
                    onChange={value =>
                      value && this.handleReservedChange(value, category)
                    }
                  />
                  <MinMax>
                    <div>{utils.getEventsWithUnit(min, category)}</div>
                    <div>{utils.getEventsWithUnit(max, category)}</div>
                  </MinMax>
                </div>
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

export default SetBudgetAndReserves;

const BaseRow = styled('div')`
  display: grid;
  grid-auto-flow: column;
  justify-content: space-between;
  align-items: center;
`;

const RowWithTag = styled(BaseRow)`
  padding: ${space(2)};
  background-color: ${p => p.theme.backgroundSecondary};
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

const LargeTitle = styled(Title)`
  font-size: ${p => p.theme.fontSizeLarge};
`;

const OptionalText = styled('span')`
  color: ${p => p.theme.subText};
  font-weight: 400;
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
  font-weight: 600;
`;

const MinMax = styled(Description)`
  font-size: ${p => p.theme.fontSizeSmall};
`;

// footer
const StepFooter = styled(PanelFooter)`
  padding: ${space(2)};
  display: grid;
  align-items: center;
  justify-content: end;
`;
