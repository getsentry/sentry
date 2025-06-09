import {Fragment, useEffect, useRef, useState} from 'react';
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

const fieldProps = {
  stacked: true,
  inline: false,
  flexibleControlStateSize: true,
} as const;

// Cryptic words for code generation
const CRYPTIC_WORDS = [
  'shadow',
  'mystic',
  'cipher',
  'stealth',
  'vortex',
  'nexus',
  'phantom',
  'quantum',
  'matrix',
  'eclipse',
  'zenith',
  'fusion',
  'vertex',
  'prism',
  'flux',
  'nova',
  'cosmic',
  'azure',
  'ember',
  'frost',
  'onyx',
  'storm',
  'blaze',
  'spark',
  'mist',
  'void',
  'core',
  'byte',
  'node',
  'link',
  'grid',
  'arch',
];

// Character substitutions for l33t speak effect
const CHAR_SUBSTITUTIONS: Record<string, string[]> = {
  a: ['@', '4'],
  e: ['3'],
  i: ['1', '!'],
  o: ['0'],
  s: ['5', '$'],
  t: ['7'],
  l: ['1'],
  g: ['9'],
  b: ['8'],
};

/**
 * Generates a cryptic promo code with random words and character substitutions
 */
function generatePromoCode(): string {
  // Select 1-3 random words (higher chance for longer codes with max 20 chars)
  const numWords = Math.random() > 0.6 ? 3 : Math.random() > 0.3 ? 2 : 1;
  const selectedWords = [];

  for (let i = 0; i < numWords; i++) {
    const word = CRYPTIC_WORDS[Math.floor(Math.random() * CRYPTIC_WORDS.length)];
    selectedWords.push(word);
  }

  let code = selectedWords.join('');

  // Apply character substitutions randomly (30% chance per applicable character)
  code = code
    .split('')
    .map(char => {
      const lowerChar = char.toLowerCase();
      if (CHAR_SUBSTITUTIONS[lowerChar] && Math.random() < 0.3) {
        const substitutions = CHAR_SUBSTITUTIONS[lowerChar];
        return substitutions[Math.floor(Math.random() * substitutions.length)];
      }
      return char;
    })
    .join('');

  // Add random numbers to reach ~10-15 characters if needed
  while (code.length < 8) {
    code += Math.floor(Math.random() * 10).toString();
  }

  // Add more numbers for variety (up to 20 chars total)
  const targetLength = Math.floor(Math.random() * 8) + 10; // 10-17 chars base
  while (code.length < targetLength && code.length < 18) {
    code += Math.floor(Math.random() * 10).toString();
  }

  // Truncate if too long (max 20 characters)
  if (code.length > 20) {
    code = code.substring(0, 20);
  }

  return code;
}

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
    setInitialFormData(prev => ({...prev, code: newCode}));

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
          ref={formRef}
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
