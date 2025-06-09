import React, {Fragment, useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import ApiForm from 'sentry/components/forms/apiForm';
import BooleanField from 'sentry/components/forms/fields/booleanField';
import DateTimeField from 'sentry/components/forms/fields/dateTimeField';
import SelectField from 'sentry/components/forms/fields/selectField';
import TextField from 'sentry/components/forms/fields/textField';
import {IconRefresh} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {useNavigate} from 'sentry/utils/useNavigate';

import type {PromoCode} from 'admin/types';
import {generatePromoCode} from 'admin/utils';

const fieldProps = {
  stacked: true,
  inline: false,
  flexibleControlStateSize: true,
} as const;

type Props = ModalRenderProps & {
  onSubmit?: (promoCode: PromoCode) => void;
  promoCode?: PromoCode;
};

const CodeFieldContainer = styled('div')`
  position: relative;
`;

const GenerateButton = styled(Button)`
  position: absolute;
  right: ${space(1)};
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
`;

function AddPromoCodeModal({Body, Header, promoCode, onSubmit, closeModal}: Props) {
  const navigate = useNavigate();
  const [isDateToggleEnabled, setIsDateToggleEnabled] = useState(false);
  const [isTrialPromo, setIsTrialPromo] = useState(false);
  const [initialFormData, setInitialFormData] = useState<any>(null);
  const formRef = useRef<any>(null);

  // Generate a default code for new promo codes
  useEffect(() => {
    if (promoCode) {
      setInitialFormData(promoCode);
    } else {
      const defaultCode = generatePromoCode();
      setInitialFormData({duration: '1', setExpiration: false, code: defaultCode});
    }
  }, [promoCode]);

  const handleGenerateCode = () => {
    const newCode = generatePromoCode();
    setInitialFormData((prev: any) => ({...prev, code: newCode}));

    // Update the form field if the form ref is available
    if (formRef.current) {
      const codeInput = formRef.current.querySelector('input[name="code"]');
      if (codeInput) {
        codeInput.value = newCode;
        // Trigger a change event to update the form state
        const event = new Event('input', {bubbles: true});
        codeInput.dispatchEvent(event);
      }
    }
  };

  // Don't render until initial data is ready
  if (!initialFormData) {
    return null;
  }

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
              navigate(`/_admin/promocodes/${newCode.code}/`);
            }
          }}
          initialData={initialFormData}
          submitLabel={promoCode ? 'Update' : 'Create'}
        >
          <CodeFieldContainer>
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
            {!promoCode && (
              <GenerateButton
                size="xs"
                type="button"
                onClick={handleGenerateCode}
                icon={<IconRefresh />}
                aria-label="Generate new promo code"
              >
                Generate
              </GenerateButton>
            )}
          </CodeFieldContainer>
          <TextField
            {...fieldProps}
            name="campaign"
            label="Campaign"
            placeholder="e.g. pycon"
            help="An optional campaign identifier for this promo code."
          />
          {React.createElement(BooleanField as any, {
            ...fieldProps,
            name: 'isTrialPromo',
            label: 'Create trial promo code?',
            placeholder: '',
            onChange: () => setIsTrialPromo(!isTrialPromo),
          })}
          {!isTrialPromo && (
            <div>
              {React.createElement(SelectField as any, {
                ...fieldProps,
                name: 'duration',
                label: 'Duration',
                help: 'How many times will this promo be applied to their account?',
                choices: [
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
                ],
                required: true,
              })}
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
          {React.createElement(BooleanField as any, {
            ...fieldProps,
            name: 'newOnly',
            label: 'Only allow this code to be applied to new accounts.',
            placeholder: '',
          })}
          {React.createElement(BooleanField as any, {
            ...fieldProps,
            name: 'setExpiration',
            label: 'Set an expiration date for the promo code?',
            placeholder: '',
            onChange: () => setIsDateToggleEnabled(!isDateToggleEnabled),
          })}
          {isDateToggleEnabled &&
            React.createElement(DateTimeField as any, {
              ...fieldProps,
              name: 'dateExpires',
              label: 'Date Expires',
              help: 'Optional date the promotion will no longer be valid after.',
              readOnly: false,
            })}
        </ApiForm>
      </Body>
    </Fragment>
  );
}

export default AddPromoCodeModal;
