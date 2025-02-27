import {Component, Fragment} from 'react';
import styled from '@emotion/styled';

import Tag from 'sentry/components/badge/tag';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';

import type {BillingConfig, Plan, Promotion, Subscription} from 'getsentry/types';
import {formatReservedWithUnits} from 'getsentry/utils/billing';
import {getPlanCategoryName, getSingularCategoryName} from 'getsentry/utils/dataCategory';
import type {CheckoutFormData} from 'getsentry/views/amCheckout/types';
import * as utils from 'getsentry/views/amCheckout/utils';

type Props = {
  activePlan: Plan;
  billingConfig: BillingConfig;
  formData: CheckoutFormData;
  onUpdate: (data: any) => void;
  organization: Organization;
  subscription: Subscription;
  discountInfo?: Promotion['discountInfo'];
};

class CheckoutOverviewV2 extends Component<Props> {
  get shortInterval() {
    const {activePlan} = this.props;
    return utils.getShortInterval(activePlan.billingInterval);
  }

  renderPlanDetails = () => {
    const {activePlan} = this.props;

    return (
      <div>
        <Subtitle>{t('Plan Type')}</Subtitle>
        <SpaceBetweenRow>
          <div>
            <Title>{tct('Sentry [name] Plan', {name: activePlan.name})}</Title>
            <Description>
              {t(
                'This is your standard %s subscription charge.',
                activePlan.billingInterval === 'annual' ? 'yearly' : 'monthly'
              )}
            </Description>
          </div>
          <Title>
            {utils.displayPrice({cents: activePlan.totalPrice})}
            {`/${this.shortInterval}`}
          </Title>
        </SpaceBetweenRow>
      </div>
    );
  };

  renderPayAsYouGoBudget = (paygBudgetTotal: number) => {
    if (paygBudgetTotal === 0) {
      return null;
    }

    return (
      <Fragment>
        <div>
          <Subtitle>{t('Additional Coverage')}</Subtitle>
          <SpaceBetweenRow style={{alignItems: 'start'}}>
            <Column>
              <Title>{t('Pay-as-you-go (PAYG) Budget')}</Title>
              <Description>
                {t('Charges are applied at the end of your monthly usage cycle.')}
              </Description>
            </Column>
            <Column>
              <Title>
                {t('up to ')}
                {`${utils.displayPrice({cents: paygBudgetTotal})}/mo`}
              </Title>
            </Column>
          </SpaceBetweenRow>
        </div>
        <Separator />
      </Fragment>
    );
  };

  renderReservedVolumes = () => {
    const {formData, activePlan} = this.props;

    const paygCategories = [
      DataCategory.MONITOR_SEATS,
      DataCategory.PROFILE_DURATION,
      DataCategory.UPTIME,
    ];

    return (
      <Section>
        <Subtitle>
          {t('Monthly Reserved Volumes ')}
          <QuestionTooltip
            title={t('Prepay for usage by reserving volumes and save up to 20%')}
            position="bottom"
            size="xs"
          />
        </Subtitle>
        <ReservedVolumes>
          {activePlan.checkoutCategories.map(category => {
            const eventBucket = utils.getBucket({
              // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
              events: formData.reserved[category],
              // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
              buckets: activePlan.planCategories[category],
            });
            const price = utils.displayPrice({cents: eventBucket.price});
            const isMoreThanIncluded =
              // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
              formData.reserved[category] > activePlan.planCategories[category][0].events;
            return (
              <SpaceBetweenRow
                key={category}
                data-test-id={`${category}-reserved`}
                style={{alignItems: 'center'}}
              >
                <ReservedItem>
                  <EmphasisText>
                    {
                      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                      formatReservedWithUnits(formData.reserved[category], category)
                    }
                  </EmphasisText>{' '}
                  {
                    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                    formData.reserved[category] === 1
                      ? getSingularCategoryName({
                          plan: activePlan,
                          category,
                        })
                      : getPlanCategoryName({plan: activePlan, category})
                  }
                  {paygCategories.includes(category as DataCategory) ? (
                    <QuestionTooltip
                      size="xs"
                      title={t(
                        "%s use your pay-as-you-go budget. You'll only be charged for actual usage.",
                        getPlanCategoryName({plan: activePlan, category})
                      )}
                    />
                  ) : null}
                </ReservedItem>
                <Price>
                  {isMoreThanIncluded ? (
                    `+ ${price}/${this.shortInterval}`
                  ) : (
                    <Tag>{t('Included')}</Tag>
                  )}
                </Price>
              </SpaceBetweenRow>
            );
          })}
        </ReservedVolumes>
      </Section>
    );
  };

  renderTotals = (committedTotal: number, paygMonthlyBudget: number) => {
    const {activePlan} = this.props;
    return (
      <div>
        <SpaceBetweenRow>
          <Title style={{lineHeight: 2}}>
            {tct('Billed [interval]', {
              interval: activePlan.billingInterval === 'annual' ? 'Annually' : 'Monthly',
            })}
          </Title>
          <Column>
            <TotalPrice>{`${utils.displayPrice({cents: committedTotal})}/${this.shortInterval}`}</TotalPrice>
          </Column>
        </SpaceBetweenRow>
        {paygMonthlyBudget > 0 ? (
          <AdditionalMonthlyCharge data-test-id="additional-monthly-charge">
            {tct('+ up to [monthlyMax] based on PAYG usage', {
              monthlyMax: (
                <EmphasisText>{`${utils.displayPrice({cents: paygMonthlyBudget})}/mo`}</EmphasisText>
              ),
            })}{' '}
            <QuestionTooltip
              size="xs"
              title={t(
                "This is your pay-as-you-go budget, which ensures continued monitoring after you've used up your reserved event volume. We’ll only charge you for actual usage, so this is your maximum charge for overage."
              )}
              position="bottom"
            />
          </AdditionalMonthlyCharge>
        ) : null}
      </div>
    );
  };

  render() {
    const {formData, activePlan} = this.props;

    const committedTotal = utils.getReservedPriceCents({...formData, plan: activePlan});
    const paygMonthlyBudget = formData.onDemandMaxSpend || 0;

    return (
      <StyledPanel data-test-id="checkout-overview-v2">
        {this.renderPlanDetails()}
        <Separator />
        {this.renderPayAsYouGoBudget(paygMonthlyBudget)}
        {this.renderReservedVolumes()}
        <Separator />
        {this.renderTotals(committedTotal, paygMonthlyBudget)}
      </StyledPanel>
    );
  }
}

const StyledPanel = styled(Panel)`
  display: grid;
  grid-template-rows: repeat(2, auto);
  gap: ${space(1.5)};
  padding: ${space(2)} ${space(2)} ${space(4)};
`;

const Column = styled('div')`
  display: grid;
  grid-template-rows: repeat(2, auto);
`;

const Description = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const SpaceBetweenRow = styled('div')`
  display: grid;
  grid-auto-flow: column;
  justify-content: space-between;
  gap: ${space(4)};
`;

const Title = styled('div')`
  font-size: ${p => p.theme.fontSizeLarge};
  font-weight: 600;
  color: ${p => p.theme.textColor};
`;

const Subtitle = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: 600;
  color: ${p => p.theme.subText};
  margin-bottom: ${space(0.5)};
`;

const ReservedVolumes = styled('div')`
  display: grid;
  gap: ${space(1.5)};
`;

const ReservedItem = styled(Title)`
  display: flex;
  gap: ${space(0.5)};
  align-items: center;
  color: ${p => p.theme.subText};
`;

const Section = styled(PanelBody)`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeLarge};
`;

const Separator = styled('div')`
  border-top: 1px solid ${p => p.theme.innerBorder};
`;

const Price = styled('div')`
  justify-self: end;
  color: ${p => p.theme.textColor};
  display: flex;
  justify-content: end;
`;

const TotalPrice = styled(Price)`
  font-size: ${p => p.theme.headerFontSize};
  font-weight: 600;
`;

const AdditionalMonthlyCharge = styled('div')`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: ${space(0.5)};
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
`;

const EmphasisText = styled('span')`
  color: ${p => p.theme.textColor};
  font-weight: 600;
`;

export default CheckoutOverviewV2;
