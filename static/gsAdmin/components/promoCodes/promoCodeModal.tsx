import {Fragment, useState} from 'react';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import ApiForm from 'sentry/components/forms/apiForm';
import BooleanField from 'sentry/components/forms/fields/booleanField';
import DateTimeField from 'sentry/components/forms/fields/dateTimeField';
import SelectField from 'sentry/components/forms/fields/selectField';
import TextField from 'sentry/components/forms/fields/textField';
import {browserHistory} from 'sentry/utils/browserHistory';

import type {PromoCode} from 'admin/types';

const fieldProps = {
  stacked: true,
  inline: false,
  flexibleControlStateSize: true,
} as const;

type Props = ModalRenderProps & {
  onSubmit?: (promoCode: PromoCode) => void;
  promoCode?: PromoCode;
};

function AddPromoCodeModal({Body, Header, promoCode, onSubmit, closeModal}: Props) {
  const [isDateToggleEnabled, setIsDateToggleEnabled] = useState(false);
  const [isTrialPromo, setIsTrialPromo] = useState(false);

  return (
    <Fragment>
      <Header closeButton>
        {promoCode ? (
          <Fragment>
            Edit <b>{promoCode.code}</b>
          </Fragment>
        ) : (
          'Add New Promo Code'
        )}
      </Header>
      <Body>
        <ApiForm
          apiMethod={promoCode ? 'PUT' : 'POST'}
          apiEndpoint={promoCode ? `/promocodes/${promoCode.code}/` : '/promocodes/'}
          onSubmitSuccess={(newCode: PromoCode) => {
            if (onSubmit) {
              onSubmit(newCode);
            }
            if (promoCode) {
              closeModal();
            } else {
              browserHistory.push(`/_admin/promocodes/${newCode.code}/`);
            }
          }}
          initialData={promoCode || {duration: '1', setExpiration: false}}
          submitLabel={promoCode ? 'Update' : 'Create'}
        >
          <TextField
            {...fieldProps}
            disabled={!!promoCode}
            name="code"
            label="Code (ID)"
            placeholder="e.g. mysecretcode79"
            help="A unique identifier for this promo code. Case-insensitive. Alphanumeric, hyphens, and underscores allowed. Must be at least 5 characters."
            minLength={5}
            required
          />
          <TextField
            {...fieldProps}
            name="campaign"
            label="Campaign"
            placeholder="e.g. pycon"
            help="An optional campaign identifier for this promo code."
          />
          <BooleanField
            {...fieldProps}
            name="isTrialPromo"
            label="Create trial promo code?"
            placeholder=""
            onChange={() => setIsTrialPromo(!isTrialPromo)}
          />
          {!isTrialPromo && (
            <div>
              <SelectField
                {...fieldProps}
                name="duration"
                label="Duration"
                help="How many times will this promo be applied to their account?"
                // TODO: make choices available on api endoint and retrieve when modal opens
                choices={[
                  ['1', 'Once'],
                  ['2', 'Two Months'],
                  ['3', 'Three Months'],
                  ['4', 'Four Months'],
                  ['5', 'Five Months'],
                  ['6', 'Six Months'],
                  ['7', 'Seven Months'],
                  ['8', 'Eight Months'],
                  ['9', 'Nine Months'],
                  ['10', 'Ten Months'],
                  ['11', 'Eleven Months'],
                  ['12', 'Twelve Months'],
                ]}
                required
              />
              <TextField
                {...fieldProps}
                name="amount"
                label="Amount"
                placeholder="e.g. 29 or 99.99"
              />
            </div>
          )}
          {isTrialPromo && (
            <TextField
              {...fieldProps}
              name="trialDays"
              label="Trial Days"
              placeholder="e.g. 30"
            />
          )}

          <TextField
            {...fieldProps}
            name="maxClaims"
            label="Max claims"
            placeholder=""
            help="The maximum number of accounts which can claim this code."
            required
          />
          <BooleanField
            {...fieldProps}
            name="newOnly"
            label="Only allow this code to be applied to new accounts."
            placeholder=""
          />
          <BooleanField
            {...fieldProps}
            name="setExpiration"
            label="Set an expiration date for the promo code?"
            placeholder=""
            onChange={() => setIsDateToggleEnabled(!isDateToggleEnabled)}
          />
          {isDateToggleEnabled && (
            <DateTimeField
              {...fieldProps}
              name="dateExpires"
              label="Date Expires"
              help="Optional date the promotion will no longer be valid after."
              readOnly={false}
            />
          )}
        </ApiForm>
      </Body>
    </Fragment>
  );
}

export default AddPromoCodeModal;
