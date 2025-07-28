import {Component, Fragment} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import type {Client} from 'sentry/api';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import withApi from 'sentry/utils/withApi';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import type {OnDemandBudgetMode, OnDemandBudgets, Subscription} from 'getsentry/types';
import {displayBudgetName} from 'getsentry/utils/billing';

import OnDemandBudgetEdit from './onDemandBudgetEdit';
import {
  convertOnDemandBudget,
  exceedsInvoicedBudgetLimit,
  getTotalBudget,
  normalizeOnDemandBudget,
  parseOnDemandBudgetsFromSubscription,
  trackOnDemandBudgetAnalytics,
} from './utils';

const ONDEMAND_BUDGET_SAVE_ERROR = t('Unable to save your on-demand budgets.');
const PAYG_BUDGET_SAVE_ERROR = t('Unable to save your pay-as-you-go budget.');
const ONDEMAND_BUDGET_EXCEEDS_INVOICED_LIMIT = t(
  'Your on-demand budget cannot exceed 5 times your monthly plan price.'
);
const PAYG_BUDGET_EXCEEDS_INVOICED_LIMIT = t(
  'Your pay-as-you-go budget cannot exceed 5 times your monthly plan price.'
);

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
            {ONDEMAND_BUDGET_SAVE_ERROR}
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
      const message =
        subscription.planDetails.budgetTerm === 'pay-as-you-go'
          ? PAYG_BUDGET_EXCEEDS_INVOICED_LIMIT
          : ONDEMAND_BUDGET_EXCEEDS_INVOICED_LIMIT;
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
    } catch (response) {
      const updateError =
        (response?.responseJSON ??
        subscription.planDetails.budgetTerm === 'pay-as-you-go')
          ? PAYG_BUDGET_SAVE_ERROR
          : ONDEMAND_BUDGET_SAVE_ERROR;
      this.setState({
        updateError,
      });
      addErrorMessage(
        subscription.planDetails.budgetTerm === 'pay-as-you-go'
          ? PAYG_BUDGET_SAVE_ERROR
          : ONDEMAND_BUDGET_SAVE_ERROR
      );
      return false;
    }
  };

  render() {
    const {Header, Footer, subscription, organization} = this.props;
    const onDemandBudgets = subscription.onDemandBudgets!;

    return (
      <Fragment>
        <Header closeButton>
          <h4>
            {tct('[action] [budgetType]', {
              action: onDemandBudgets.enabled ? t('Edit') : t('Set Up'),
              budgetType: displayBudgetName(subscription.planDetails, {
                title: true,
                withBudget: true,
                pluralOndemand: true,
              }),
            })}
          </h4>
        </Header>
        <OffsetBody>
          {this.renderError(this.state.updateError)}
          <OnDemandBudgetEdit
            onDemandEnabled={onDemandBudgets.enabled}
            onDemandSupported
            currentBudgetMode={onDemandBudgets.budgetMode}
            onDemandBudget={this.state.onDemandBudget}
            setBudgetMode={this.setBudgetMode}
            setOnDemandBudget={onDemandBudget => {
              this.setState({
                onDemandBudget,
              });
            }}
            activePlan={subscription.planDetails}
            organization={organization}
            subscription={subscription}
          />
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
