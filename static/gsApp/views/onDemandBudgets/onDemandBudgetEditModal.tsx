import {Component, Fragment} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import type {Client} from 'sentry/api';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {Alert} from 'sentry/components/core/alert';
import {Input} from 'sentry/components/core/input';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import withApi from 'sentry/utils/withApi';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import type {OnDemandBudgets, Subscription} from 'getsentry/types';
import {OnDemandBudgetMode, PlanTier} from 'getsentry/types';

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

function coerceValue(value: number): number {
  return value / 100;
}

function parseInputValue(e: React.ChangeEvent<HTMLInputElement>) {
  let value = parseInt(e.target.value, 10) || 0;
  value = Math.max(value, 0);
  const cents = value * 100;
  return cents;
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
          <Alert system type="error" showIcon>
            {ONDEMAND_BUDGET_SAVE_ERROR}
          </Alert>
        );
      }

      return (
        <Alert system type="error" showIcon>
          <ul>{listOfErrors}</ul>
        </Alert>
      );
    }

    return (
      <Alert system type="error" showIcon>
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
        subscription.planTier === PlanTier.AM3
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
        response?.responseJSON ?? subscription.planTier === PlanTier.AM3
          ? PAYG_BUDGET_SAVE_ERROR
          : ONDEMAND_BUDGET_SAVE_ERROR;
      this.setState({
        updateError,
      });
      addErrorMessage(
        subscription.planTier === PlanTier.AM3
          ? PAYG_BUDGET_SAVE_ERROR
          : ONDEMAND_BUDGET_SAVE_ERROR
      );
      return false;
    }
  };

  renderInputFields = (displayBudgetMode: OnDemandBudgetMode) => {
    const {onDemandBudget} = this.state;
    if (
      onDemandBudget.budgetMode === OnDemandBudgetMode.SHARED &&
      displayBudgetMode === OnDemandBudgetMode.SHARED
    ) {
      return (
        <InputFields style={{alignSelf: 'center'}}>
          <Currency>
            <OnDemandInput
              aria-label="shared max budget input"
              name="sharedMaxBudget"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={7}
              placeholder="e.g. 50"
              value={coerceValue(onDemandBudget.sharedMaxBudget)}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                this.setState({
                  onDemandBudget: {
                    ...onDemandBudget,
                    sharedMaxBudget: parseInputValue(e),
                  },
                });
              }}
            />
          </Currency>
        </InputFields>
      );
    }

    if (
      onDemandBudget.budgetMode === OnDemandBudgetMode.PER_CATEGORY &&
      displayBudgetMode === OnDemandBudgetMode.PER_CATEGORY
    ) {
      return (
        <InputFields>
          <DetailTitle style={{marginTop: 0}}>{t('Errors')}</DetailTitle>
          <Currency>
            <OnDemandInput
              aria-label="errors budget input"
              name="errorsBudget"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={7}
              placeholder="e.g. 50"
              value={coerceValue(onDemandBudget.errorsBudget)}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                this.setState({
                  onDemandBudget: {
                    ...onDemandBudget,
                    errorsBudget: parseInputValue(e),
                  },
                });
              }}
            />
          </Currency>
          <DetailTitle>{t('Transactions')}</DetailTitle>
          <Currency>
            <OnDemandInput
              aria-label="transactions budget input"
              name="transactionsBudget"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={7}
              placeholder="e.g. 50"
              value={coerceValue(onDemandBudget.transactionsBudget)}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                this.setState({
                  onDemandBudget: {
                    ...onDemandBudget,
                    transactionsBudget: parseInputValue(e),
                  },
                });
              }}
            />
          </Currency>
          <DetailTitle>{t('Attachments')}</DetailTitle>
          <Currency>
            <OnDemandInput
              aria-label="attachments budget input"
              name="attachmentsBudget"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={7}
              placeholder="e.g. 50"
              value={coerceValue(onDemandBudget.attachmentsBudget)}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                this.setState({
                  onDemandBudget: {
                    ...onDemandBudget,
                    attachmentsBudget: parseInputValue(e),
                  },
                });
              }}
            />
          </Currency>
        </InputFields>
      );
    }

    return null;
  };

  render() {
    const {Header, Footer, subscription, organization} = this.props;
    const onDemandBudgets = subscription.onDemandBudgets!;

    return (
      <Fragment>
        <Header closeButton>
          <h4>
            {subscription.planTier === PlanTier.AM3
              ? onDemandBudgets.enabled
                ? t('Edit Pay-as-you-go Budget')
                : t('Set Up pay-as-you-go')
              : onDemandBudgets.enabled
                ? t('Edit On-Demand Budgets')
                : t('Set Up On-Demand')}
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
          <ButtonBar gap={1}>
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

const InputFields = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
  align-items: flex-end;
`;

const Currency = styled('div')`
  &::before {
    padding: 10px 10px 9px;
    position: absolute;
    content: '$';
    color: ${p => p.theme.textColor};
    font-size: ${p => p.theme.fontSizeLarge};
    line-height: ${p => p.theme.fontSizeLarge};
  }
`;

const OnDemandInput = styled(Input)`
  padding-left: ${space(4)};
  color: ${p => p.theme.textColor};
  max-width: 140px;
  height: 36px;
`;

const DetailTitle = styled('div')`
  text-transform: uppercase;
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray300};
  margin-top: ${space(0.5)};
`;

const OffsetBody = styled('div')`
  margin: -${space(3)} -${space(4)};

  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    margin: -${space(3)};
  }
`;

export default withApi(OnDemandBudgetEditModal);
