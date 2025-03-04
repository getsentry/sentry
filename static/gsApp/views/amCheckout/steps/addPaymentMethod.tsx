import {useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelFooter from 'sentry/components/panels/panelFooter';
import PanelItem from 'sentry/components/panels/panelItem';
import {Radio} from 'sentry/components/radio';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

import CreditCardSetup from 'getsentry/components/creditCardSetup';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import StepHeader from 'getsentry/views/amCheckout/steps/stepHeader';
import type {StepProps} from 'getsentry/views/amCheckout/types';

type Props = StepProps;

function AddPaymentMethod({
  subscription,
  organization,
  isActive,
  stepNumber,
  isCompleted,
  onEdit,
  onCompleteStep,
  prevStepCompleted,
}: Props) {
  const [useExisting, setUseExisting] = useState(true);
  const title = t('Payment Method');
  const hasPayment = subscription.paymentSource && !!subscription.paymentSource.last4;

  const onPaymentAccepted = (data: any) => {
    onCompleteStep(stepNumber);

    SubscriptionStore.set(data.slug, data);
    setUseExisting(true);
  };

  function renderBody() {
    const cardComponent = (
      <AddCardSetup
        organization={organization}
        onSuccess={onPaymentAccepted}
        buttonText="Continue"
      />
    );

    if (!hasPayment) {
      return <PanelBody data-test-id="body-payment-method">{cardComponent}</PanelBody>;
    }

    return (
      <PanelBody data-test-id="body-payment-method">
        <CreditCardOption
          isSelected={useExisting}
          onClick={() => setUseExisting(true)}
          data-test-id="existing-card"
        >
          <Label>
            <StyledRadio readOnly name="existing-card" checked={useExisting} />
            <CardDetails>
              {tct('Existing card on file ending in [last4]', {
                last4: subscription.paymentSource?.last4,
              })}

              {!!subscription.paymentSource?.zipCode && (
                <Description>
                  {tct('Postal code [zip]', {
                    zip: subscription.paymentSource?.zipCode,
                  })}
                </Description>
              )}
            </CardDetails>
          </Label>
        </CreditCardOption>
        <CreditCardOption
          isSelected={!useExisting}
          onClick={() => setUseExisting(false)}
          data-test-id="new-card"
        >
          <Label>
            <StyledRadio readOnly name="new-card" checked={!useExisting} />
            <CardDetails>{t('Add new card')}</CardDetails>
          </Label>
        </CreditCardOption>
        {!useExisting && cardComponent}
      </PanelBody>
    );
  }

  return (
    <Panel>
      <StepHeader
        canSkip={prevStepCompleted}
        title={title}
        isActive={isActive}
        stepNumber={stepNumber}
        isCompleted={isCompleted}
        onEdit={onEdit}
      />
      {isActive && renderBody()}
      {isActive && hasPayment && useExisting && (
        <StepFooter data-test-id="footer-payment-method">
          <Button priority="primary" onClick={() => onCompleteStep(stepNumber)}>
            {t('Continue')}
          </Button>
        </StepFooter>
      )}
    </Panel>
  );
}

const CreditCardOption = styled(PanelItem)<{isSelected?: boolean}>`
  padding: 0;
  border-bottom: 1px solid ${p => p.theme.innerBorder};

  ${p =>
    p.isSelected &&
    css`
      background: ${p.theme.backgroundSecondary};
      color: ${p.theme.textColor};
    `}
`;

const Label = styled('label')`
  display: grid;
  grid-template-columns: max-content auto;
  gap: ${space(1.5)};
  padding: ${space(2)};
  color: ${p => p.theme.textColor};
  font-weight: normal;
  width: 100%;
  margin: 0;
`;

const StyledRadio = styled(Radio)`
  background: ${p => p.theme.background};
`;

const CardDetails = styled('div')`
  display: inline-grid;
  gap: ${space(0.75)};
  font-size: ${p => p.theme.fontSizeExtraLarge};
  color: ${p => p.theme.textColor};
  font-weight: 600;
`;

const Description = styled(TextBlock)`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.subText};
  margin: 0;
  font-weight: normal;
`;

const AddCardSetup = styled(CreditCardSetup)`
  padding: ${space(2)} ${space(2)} 0;
  color: ${p => p.theme.textColor};

  .form-actions {
    display: grid;
    justify-items: end;
    border-top: 1px solid ${p => p.theme.border};
    padding: ${space(2)};
    margin: -${space(0.5)} -${space(2)} 0;
  }
`;

const StepFooter = styled(PanelFooter)`
  padding: ${space(2)};
  display: grid;
  align-items: center;
  justify-content: end;
`;

export default AddPaymentMethod;
