import {Component, Fragment} from 'react';
import styled from '@emotion/styled';

import {Container} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import type {Client} from 'sentry/api';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import withApi from 'sentry/utils/withApi';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import type {
  OnDemandBudgetMode,
  OnDemandBudgets,
  Plan,
  Subscription,
} from 'getsentry/types';
import {displayBudgetName} from 'getsentry/utils/billing';
import EmbeddedSpendLimitSettings from 'getsentry/views/spendLimits/embeddedSettings';
import {
  convertOnDemandBudget,
  exceedsInvoicedBudgetLimit,
  getTotalBudget,
  normalizeOnDemandBudget,
  parseOnDemandBudgetsFromSubscription,
  trackOnDemandBudgetAnalytics,
} from 'getsentry/views/spendLimits/utils';

function getBudgetSaveError(plan: Plan) {
  return t(
    'Unable to save your %s',
    displayBudgetName(plan, {
      pluralOndemand: true,
      withBudget: true,
    })
  );
}

function getBudgetExceededInvoicedLimitError(plan: Plan) {
  return t(
    'Your %s cannot exceed 5 times your monthly plan price.',
    displayBudgetName(plan, {withBudget: true})
  );
}

type Props = {
  api: Client;
  organization: Organization;
  subscription: Subscription;
} & ModalRenderProps;

type State = {
  currentOnDemandBudget: OnDemandBudgets;
  onDemandBudget: OnDemandBudgets;
  updateError: undefined | Error | string | Record<string, string[]>;
};
class OnDemandBudgetEditModal extends Component<Props, State> {
  constructor(props: Props) {
    super(props);

    const {subscription} = props;
    const onDemandBudget = parseOnDemandBudgetsFromSubscription(subscription);

    this.state = {
      currentOnDemandBudget: {...onDemandBudget},
      onDemandBudget,
      updateError: undefined,
    };
  }

  renderError(error: State['updateError']) {
    if (!error) {
      return null;
    }

    if (!(error instanceof Error) && typeof error === 'object') {
      const listOfErrors = Object.entries(error).map(
        ([field, errors]: [string, string[]]) => {
          return (
            <li key={field}>
              <strong>{field}</strong> {errors.join(' ')}
            </li>
          );
        }
      );

      if (listOfErrors.length === 0) {
        return (
          <Alert system type="error">
            {getBudgetSaveError(this.props.subscription.planDetails)}
          </Alert>
        );
      }

      return (
        <Alert system type="error">
          <ul>{listOfErrors}</ul>
        </Alert>
      );
    }

    return (
      <Alert system type="error">
        {/* TODO(TS): Type says error might be an object */}
        {error as React.ReactNode}
      </Alert>
    );
  }

  getTotalBudget = (): number => {
    const {onDemandBudget} = this.state;
    return getTotalBudget(onDemandBudget);
  };

  setBudgetMode = (nextMode: OnDemandBudgetMode) => {
    const {currentOnDemandBudget, onDemandBudget} = this.state;
    if (nextMode === onDemandBudget.budgetMode) {
      return;
    }
    this.setState({
      onDemandBudget: convertOnDemandBudget(currentOnDemandBudget, nextMode),
    });
  };

  handleSave = () => {
    const {subscription} = this.props;
    const newOnDemandBudget = normalizeOnDemandBudget(this.state.onDemandBudget);

    if (exceedsInvoicedBudgetLimit(subscription, newOnDemandBudget)) {
      const message = getBudgetExceededInvoicedLimitError(subscription.planDetails);
      this.setState({
        updateError: message,
      });
      addErrorMessage(message);
      return;
    }

    this.saveOnDemandBudget(newOnDemandBudget).then(saveSuccess => {
      if (saveSuccess) {
        const {organization} = this.props;
        trackOnDemandBudgetAnalytics(
          organization,
          this.state.currentOnDemandBudget,
          newOnDemandBudget,
          'ondemand_budget_modal'
        );

        if (this.getTotalBudget() > 0) {
          addSuccessMessage(t('Budget updated'));
        } else {
          addSuccessMessage(t('Budget turned off'));
        }

        this.props.closeModal();
      }
    });
  };

  saveOnDemandBudget = async (ondemandBudget: OnDemandBudgets): Promise<boolean> => {
    const {subscription} = this.props;

    try {
      await this.props.api.requestPromise(
        `/customers/${subscription.slug}/ondemand-budgets/`,
        {
          method: 'POST',
          data: ondemandBudget,
        }
      );
      SubscriptionStore.loadData(subscription.slug);
      return true;
    } catch (response: any) {
      const updateError =
        response?.responseJSON ?? getBudgetSaveError(subscription.planDetails);
      this.setState({
        updateError,
      });
      addErrorMessage(getBudgetSaveError(subscription.planDetails));
      return false;
    }
  };

  render() {
    const {Footer, subscription, organization} = this.props;
    const addOnDataCategories = Object.values(
      subscription.planDetails.addOnCategories
    ).flatMap(addOn => addOn.dataCategories);
    const currentReserved = Object.fromEntries(
      Object.entries(subscription.categories)
        .filter(([category]) => !addOnDataCategories.includes(category as DataCategory))
        .map(([category, categoryInfo]) => [category, categoryInfo.reserved ?? 0])
    );

    return (
      <Fragment>
        <OffsetBody>
          {this.renderError(this.state.updateError)}
          <Container padding="2xl">
            <EmbeddedSpendLimitSettings
              organization={organization}
              subscription={subscription}
              header={
                <Heading as="h2" size="xl">
                  {tct('Set your [budgetTerm] limit', {
                    budgetTerm: displayBudgetName(subscription.planDetails),
                  })}
                </Heading>
              }
              activePlan={subscription.planDetails}
              initialOnDemandBudgets={parseOnDemandBudgetsFromSubscription(subscription)}
              currentReserved={currentReserved}
              addOns={subscription.addOns ?? {}}
              onUpdate={({onDemandBudgets}) => {
                this.setState({
                  onDemandBudget: onDemandBudgets,
                });
              }}
            />
          </Container>
        </OffsetBody>
        <Footer>
          <ButtonBar>
            <Button
              onClick={() => {
                this.props.closeModal();
              }}
            >
              {t('Cancel')}
            </Button>
            <Button priority="primary" onClick={this.handleSave}>
              {t('Save')}
            </Button>
          </ButtonBar>
        </Footer>
      </Fragment>
    );
  }
}

const OffsetBody = styled('div')`
  margin: -${space(3)} -${space(4)};

  @media (max-width: ${p => p.theme.breakpoints.md}) {
    margin: -${space(3)};
  }
`;

export default withApi(OnDemandBudgetEditModal);
