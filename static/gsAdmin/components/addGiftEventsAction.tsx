import {Component} from 'react';

import TextField from 'sentry/components/forms/fields/textField';
import {DataCategory} from 'sentry/types/core';

import type {
  AdminConfirmParams,
  AdminConfirmRenderProps,
} from 'admin/components/adminConfirmationModal';
import {MAX_ADMIN_CATEGORY_GIFTS} from 'getsentry/constants';
import type {Subscription} from 'getsentry/types';
import {getPlanCategoryName} from 'getsentry/utils/dataCategory';

/** @internal exported for tests only */
export const FREE_EVENTS_KEYS = {
  [DataCategory.ERRORS]: 'addFreeErrors',
  [DataCategory.TRANSACTIONS]: 'addFreeTransactions',
  [DataCategory.REPLAYS]: 'addFreeReplays',
  [DataCategory.ATTACHMENTS]: 'addFreeAttachments',
  [DataCategory.MONITOR_SEATS]: 'addFreeMonitorSeats',
  [DataCategory.UPTIME]: 'addFreeUptime',
  [DataCategory.SPANS]: 'addFreeSpans',
  [DataCategory.SPANS_INDEXED]: 'addFreeSpansIndexed',
  [DataCategory.PROFILE_DURATION]: 'addFreeProfileDuration',
};

/**
 * Used so form can show "How many errors in multiples of 1,000s? (50 is 50,000 errors)"
 * and calculate total based on the multiplier
 */
const DISPLAY_FREE_EVENTS_MULTIPLE = {
  [DataCategory.ERRORS]: 1_000,
  [DataCategory.TRANSACTIONS]: 1_000,
  [DataCategory.REPLAYS]: 1,
  [DataCategory.ATTACHMENTS]: 1, // GB
  [DataCategory.MONITOR_SEATS]: 1,
  [DataCategory.UPTIME]: 1,
  [DataCategory.SPANS]: 100_000,
  [DataCategory.SPANS_INDEXED]: 100_000,
  [DataCategory.PROFILE_DURATION]: 1, // hours
};

type Props = AdminConfirmRenderProps & {
  dataCategory: DataCategory;
  subscription: Subscription;
};

type State = {
  freeEvents?: number;
};

/**
 * Rendered as part of a openAdminConfirmModal call
 */
class AddGiftEventsAction extends Component<Props, State> {
  state: State = {
    freeEvents: undefined,
  };

  componentDidMount() {
    this.props.setConfirmCallback(this.handleConfirm);
    this.props.disableConfirmButton(true);
  }

  handleChange = (value: string) => {
    const freeEvents = this.coerceValue(value);
    this.props.disableConfirmButton(freeEvents === 0);
    this.setState({freeEvents});
  };

  coerceValue(value: string) {
    const {dataCategory} = this.props;

    const intValue = parseInt(value, 10);
    const maxValue =
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      MAX_ADMIN_CATEGORY_GIFTS[dataCategory] / DISPLAY_FREE_EVENTS_MULTIPLE[dataCategory];

    if (isNaN(intValue) || intValue < 0) {
      return undefined;
    }

    return intValue > maxValue ? maxValue : intValue;
  }

  handleConfirm = (params: AdminConfirmParams) => {
    const {onConfirm, dataCategory} = this.props;

    const freeEvents = this.calculatedTotal;
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    const freeEventsKey = FREE_EVENTS_KEYS[dataCategory];

    onConfirm?.({[freeEventsKey]: freeEvents, ...params});

    this.resetValue();
  };

  resetValue = () => {
    this.setState({freeEvents: 0});
  };

  get calculatedTotal() {
    const {dataCategory} = this.props;
    const {freeEvents} = this.state;

    if (!freeEvents) {
      return 0;
    }
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    return freeEvents * DISPLAY_FREE_EVENTS_MULTIPLE[dataCategory];
  }

  render() {
    const {dataCategory, subscription} = this.props;
    const {freeEvents} = this.state;

    function getlabel() {
      if (dataCategory === DataCategory.ATTACHMENTS) {
        return 'How many attachments in GB?';
      }
      if (dataCategory === DataCategory.PROFILE_DURATION) {
        return 'How many profile hours?';
      }
      const categoryName = getPlanCategoryName({
        plan: subscription.planDetails,
        category: dataCategory,
        capitalize: false,
      });
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      const multiplier = DISPLAY_FREE_EVENTS_MULTIPLE[dataCategory];
      const addToMessage =
        multiplier > 1
          ? ` in multiples of ${multiplier.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}s?`
          : '?';
      return `How many ${categoryName}${addToMessage} (50 is ${(50 * multiplier).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')} ${categoryName})`;
    }

    const total = this.calculatedTotal.toLocaleString();
    function getHelp() {
      let postFix = '';
      if (dataCategory === DataCategory.PROFILE_DURATION) {
        if (total === '1') {
          postFix = ' hour';
        } else {
          postFix = ' hours';
        }
      }
      if (dataCategory === DataCategory.ATTACHMENTS) {
        postFix = ' GB';
      }
      return `Total: ${total}${postFix}`;
    }

    return (
      <TextField
        autoFocus
        inline={false}
        stacked
        flexibleControlStateSize
        data-test-id={`num-free-${dataCategory}`}
        label={getlabel()}
        help={getHelp()}
        name={dataCategory}
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={dataCategory === DataCategory.REPLAYS ? 7 : 5}
        value={freeEvents && !isNaN(freeEvents) ? freeEvents.toString() : ''}
        onChange={this.handleChange}
      />
    );
  }
}

export default AddGiftEventsAction;
