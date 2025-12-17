import {Component} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {ExternalLink} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import PanelBody from 'sentry/components/panels/panelBody';
import {IconQuestion} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';

import {openEditCreditCard} from 'getsentry/actionCreators/modal';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import type {Subscription} from 'getsentry/types';
import {OnDemandBudgetMode, PlanTier} from 'getsentry/types';
import {displayBudgetName, getOnDemandCategories} from 'getsentry/utils/billing';
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
            `%s allows you to pay for additional data beyond your subscription's
                reserved quotas. %s is billed monthly at the end of each usage period.`,
            displayBudgetName(subscription.planDetails, {title: true}),
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
          {subscription.sponsoredType !== 'education' && (
            <LinkButton to={`/settings/${organization.slug}/support/`}>
              {t('Contact Support')}
            </LinkButton>
          )}
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
              subscription,
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
          {getOnDemandCategories({
            plan: subscription.planDetails,
            budgetMode: onDemandBudgets.budgetMode,
          })
            .filter(category => category !== DataCategory.LOG_BYTE)
            .map(category => (
              <Category key={category}>
                <DetailTitle>
                  {getPlanCategoryName({plan: subscription.planDetails, category})}
                </DetailTitle>
                <Amount>{formatCurrency(onDemandBudgets.budgets[category] ?? 0)}</Amount>
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

    if (!hasPaymentSource) {
      return this.renderNeedsPaymentSource();
    }

    const onDemandBudgets = subscription.onDemandBudgets!;
    const oxfordCategories = listDisplayNames({
      plan: subscription.planDetails,
      categories: getOnDemandCategories({
        plan: subscription.planDetails,
        budgetMode: onDemandBudgets.budgetMode,
      }).filter(category =>
        onDemandBudgets.budgetMode === OnDemandBudgetMode.PER_CATEGORY
          ? category !== DataCategory.LOG_BYTE
          : true
      ),
    });
    let description = t('Applies to %s.', oxfordCategories);

    if (
      onDemandBudgets.budgetMode === OnDemandBudgetMode.SHARED &&
      onDemandBudgets.sharedMaxBudget > 0
    ) {
      description = t(
        'Your %s is shared among all categories on a first come, first serve basis. There are no restrictions for any single category consuming the entire budget.',
        displayBudgetName(subscription.planDetails, {withBudget: true})
      );
    } else if (onDemandBudgets.budgetMode === OnDemandBudgetMode.PER_CATEGORY) {
      description = t(
        'You have dedicated %s for %s.',
        displayBudgetName(subscription.planDetails, {withBudget: true}),
        oxfordCategories
      );
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
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
  margin-bottom: ${space(1)};
  white-space: nowrap;
`;

const Amount = styled('div')`
  color: ${p => p.theme.tokens.content.primary};
  font-size: ${p => p.theme.fontSize.xl};
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
