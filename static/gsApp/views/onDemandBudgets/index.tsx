import {Component} from 'react';
import styled from '@emotion/styled';

import {Button, LinkButton} from 'sentry/components/core/button';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import ExternalLink from 'sentry/components/links/externalLink';
import PanelBody from 'sentry/components/panels/panelBody';
import {Tooltip} from 'sentry/components/tooltip';
import {IconQuestion} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';

import {openEditCreditCard} from 'getsentry/actionCreators/modal';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import type {Subscription} from 'getsentry/types';
import {OnDemandBudgetMode, PlanTier} from 'getsentry/types';
import {displayBudgetName} from 'getsentry/utils/billing';
import {getPlanCategoryName, listDisplayNames} from 'getsentry/utils/dataCategory';
import formatCurrency from 'getsentry/utils/formatCurrency';
import {openOnDemandBudgetEditModal} from 'getsentry/views/onDemandBudgets/editOnDemandButton';

type Props = {
  hasPaymentSource: boolean;
  onDemandEnabled: boolean;
  organization: Organization;
  subscription: Subscription;
};

class OnDemandBudgets extends Component<Props> {
  renderLabel = () => {
    const {subscription} = this.props;
    return (
      <Label>
        {tct('[budgetType]', {
          budgetType: displayBudgetName(subscription.planDetails, {
            title: true,
            withBudget: true,
            pluralOndemand: true,
          }),
        })}
        <Tooltip
          title={t(
            `%s you to pay for additional data beyond your subscription's
                reserved quotas. %s is billed monthly at the end of each usage period.`,
            subscription.planDetails.budgetTerm === 'pay-as-you-go'
              ? 'Pay-as-you-go allows'
              : 'On-Demand budgets allow',
            displayBudgetName(subscription.planDetails, {title: true})
          )}
          skipWrapper
        >
          <ExternalLink
            href={
              subscription.planTier === PlanTier.AM3
                ? `https://docs.sentry.io/pricing/#pricing-how-it-works`
                : `https://docs.sentry.io/pricing/legacy-pricing/#pricing-how-it-works`
            }
            aria-label={t('Visit docs')}
          >
            <IconQuestion aria-hidden="true" size="xs" />
          </ExternalLink>
        </Tooltip>
      </Label>
    );
  };

  renderNotEnabled() {
    const {organization, subscription} = this.props;

    return (
      <FieldGroup
        label={this.renderLabel()}
        help={tct('[budgetType] is not supported for your account.', {
          budgetType: displayBudgetName(subscription.planDetails, {title: true}),
        })}
      >
        <div>
          <LinkButton to={`/settings/${organization.slug}/support/`}>
            {t('Contact Support')}
          </LinkButton>
        </div>
      </FieldGroup>
    );
  }

  renderNeedsPaymentSource() {
    const {organization, subscription} = this.props;

    const budgetTerm = subscription.planDetails.budgetTerm;
    const budgetString =
      budgetTerm === 'pay-as-you-go' ? 'a pay-as-you-go budget' : 'on-demand budgets';

    const label = tct("To set [budgetType], you'll need a valid credit card on file.", {
      budgetType: budgetString,
    });
    const action = (
      <div>
        <Button
          priority="primary"
          data-test-id="add-cc-card"
          onClick={() =>
            openEditCreditCard({
              organization,
              onSuccess: (data: Subscription) => {
                SubscriptionStore.set(organization.slug, data);
              },
            })
          }
        >
          {t('Add Credit Card')}
        </Button>
      </div>
    );

    return (
      <PanelBody withPadding>
        <ContentWrapper>
          <div>{label}</div>
          {action}
        </ContentWrapper>
      </PanelBody>
    );
  }

  renderBudgetInfo() {
    const {subscription} = this.props;
    const onDemandBudgets = subscription.onDemandBudgets!;
    if (onDemandBudgets.budgetMode === OnDemandBudgetMode.SHARED) {
      return (
        <Category data-test-id="shared-budget-info">
          <DetailTitle>
            {subscription.planTier === PlanTier.AM3 ? t('Budget') : t('Shared Budget')}
          </DetailTitle>
          <Amount>{formatCurrency(onDemandBudgets.sharedMaxBudget)}</Amount>
        </Category>
      );
    }
    if (onDemandBudgets.budgetMode === OnDemandBudgetMode.PER_CATEGORY) {
      return (
        <PerCategoryBudgetContainer data-test-id="per-category-budget-info">
          {subscription.planDetails.onDemandCategories.map(category => (
            <Category key={category}>
              <DetailTitle>
                {getPlanCategoryName({plan: subscription.planDetails, category})}
              </DetailTitle>
              <Amount>
                {
                  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                  formatCurrency(onDemandBudgets.budgets[category] ?? 0)
                }
              </Amount>
            </Category>
          ))}
        </PerCategoryBudgetContainer>
      );
    }

    return null;
  }

  renderContent() {
    const {subscription} = this.props;
    const onDemandBudgets = subscription.onDemandBudgets!;

    if (!onDemandBudgets.enabled) {
      return (
        <InlineButtonGroup>
          <LinkButton
            href={
              subscription.planTier === PlanTier.AM3
                ? `https://docs.sentry.io/pricing/#pricing-how-it-works`
                : `https://docs.sentry.io/pricing/legacy-pricing/#on-demand-volume`
            }
            external
          >
            {t('Learn More')}
          </LinkButton>
          <Button
            priority="primary"
            onClick={() => {
              openOnDemandBudgetEditModal(this.props);
            }}
          >
            {tct('Set Up [budgetType]', {
              budgetType: displayBudgetName(subscription.planDetails, {title: true}),
            })}
          </Button>
        </InlineButtonGroup>
      );
    }

    return <ContentWrapper>{this.renderBudgetInfo()}</ContentWrapper>;
  }

  render() {
    const {onDemandEnabled, hasPaymentSource, subscription} = this.props;

    if (!onDemandEnabled) {
      return this.renderNotEnabled();
    }

    if (!hasPaymentSource && !subscription.onDemandInvoicedManual) {
      return this.renderNeedsPaymentSource();
    }

    const oxfordCategories = listDisplayNames({
      plan: subscription.planDetails,
      categories: subscription.planDetails.onDemandCategories,
    });
    let description = t('Applies to %s.', oxfordCategories);

    const onDemandBudgets = subscription.onDemandBudgets!;
    if (
      onDemandBudgets.budgetMode === OnDemandBudgetMode.SHARED &&
      onDemandBudgets.sharedMaxBudget > 0
    ) {
      const budgetType = subscription.planDetails.budgetTerm;
      description =
        budgetType === 'pay-as-you-go'
          ? t(
              'Your pay-as-you-go budget is shared among all categories on a first come, first serve basis. There are no restrictions for any single category consuming the entire budget.'
            )
          : t(
              'Your on-demand budget is shared among all categories on a first come, first serve basis. There are no restrictions for any single category consuming the entire budget.'
            );
    } else if (onDemandBudgets.budgetMode === OnDemandBudgetMode.PER_CATEGORY) {
      description = t('You have dedicated on-demand budget for %s.', oxfordCategories);
    }

    const keepInline =
      !onDemandBudgets.enabled ||
      onDemandBudgets.budgetMode === OnDemandBudgetMode.SHARED;
    return (
      <StyledPanelBody withPadding keepInline={keepInline}>
        <div style={{maxWidth: keepInline ? '70%' : undefined}}>{description}</div>
        {this.renderContent()}
      </StyledPanelBody>
    );
  }
}

const InlineButtonGroup = styled('div')`
  display: inline-flex;
  gap: ${space(1)};
`;

const ContentWrapper = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${space(3)};
  align-items: center;
`;

const Label = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
`;

const DetailTitle = styled('div')`
  text-transform: uppercase;
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  margin-bottom: ${space(1)};
  white-space: nowrap;
`;

const Amount = styled('div')`
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.fontSizeExtraLarge};
`;

const PerCategoryBudgetContainer = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${space(3)};
  align-items: center;
`;

const Category = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
`;

const StyledPanelBody = styled(PanelBody)<{keepInline: boolean}>`
  display: flex;
  flex-direction: ${p => (p.keepInline ? 'row' : 'column')};
  justify-content: space-between;
  gap: ${p => (p.keepInline ? space(4) : space(2))};
`;

export default OnDemandBudgets;
