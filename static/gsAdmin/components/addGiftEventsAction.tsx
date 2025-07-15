import {Component} from 'react';

import TextField from 'sentry/components/forms/fields/textField';
import {DataCategory} from 'sentry/types/core';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';

import type {
  AdminConfirmParams,
  AdminConfirmRenderProps,
} from 'admin/components/adminConfirmationModal';
import type {BilledDataCategoryInfo, Subscription} from 'getsentry/types';
import {
  getPlanCategoryName,
  isByteCategory,
  isContinuousProfiling,
} from 'getsentry/utils/dataCategory';

/** @internal exported for tests only */
export function getFreeEventsKey(dataCategory: DataCategory) {
  return `addFree${toTitleCase(dataCategory, {allowInnerUpperCase: true})}`;
}

type Props = AdminConfirmRenderProps & {
  billedCategoryInfo: BilledDataCategoryInfo | null;
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
    const {billedCategoryInfo} = this.props;

    const intValue = parseInt(value, 10);
    const maxValue =
      (billedCategoryInfo?.maxAdminGift ?? 0) /
      (billedCategoryInfo?.freeEventsMultiple ?? 1); // prevent ZeroDivisionError

    if (isNaN(intValue) || intValue < 0) {
      return undefined;
    }

    return intValue > maxValue ? maxValue : intValue;
  }

  handleConfirm = (params: AdminConfirmParams) => {
    const {onConfirm, dataCategory} = this.props;

    const freeEvents = this.calculatedTotal;
    const freeEventsKey = getFreeEventsKey(dataCategory);

    onConfirm?.({[freeEventsKey]: freeEvents, ...params});

    this.resetValue();
  };

  resetValue = () => {
    this.setState({freeEvents: 0});
  };

  get calculatedTotal() {
    const {billedCategoryInfo} = this.props;
    const {freeEvents} = this.state;

    if (!freeEvents) {
      return 0;
    }
    return freeEvents * (billedCategoryInfo?.freeEventsMultiple ?? 0);
  }

  render() {
    const {billedCategoryInfo, dataCategory, subscription} = this.props;
    const {freeEvents} = this.state;

    function getlabel() {
      if (dataCategory === DataCategory.ATTACHMENTS) {
        return 'How many attachments in GB?';
      }
      if (dataCategory === DataCategory.LOG_BYTE) {
        return 'How many log bytes in GB?';
      }
      if (isContinuousProfiling(dataCategory)) {
        return 'How many profile hours?';
      }
      const categoryName = getPlanCategoryName({
        plan: subscription.planDetails,
        category: dataCategory,
        capitalize: false,
      });
      const multiplier = billedCategoryInfo?.freeEventsMultiple ?? 0;
      const addToMessage =
        multiplier > 1
          ? ` in multiples of ${multiplier.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}s?`
          : '?';
      return `How many ${categoryName}${addToMessage} (50 is ${(50 * multiplier).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')} ${categoryName})`;
    }

    const total = this.calculatedTotal.toLocaleString();
    function getHelp() {
      let postFix = '';
      if (isContinuousProfiling(dataCategory)) {
        if (total === '1') {
          postFix = ' hour';
        } else {
          postFix = ' hours';
        }
      }
      if (isByteCategory(dataCategory)) {
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
