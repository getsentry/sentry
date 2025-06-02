import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import ExternalLink from 'sentry/components/links/externalLink';
import {IconClose} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import useDismissAlert from 'sentry/utils/useDismissAlert';

import useSubscription from 'getsentry/hooks/useSubscription';
import {BillingType} from 'getsentry/types';

// Temporary Seer beta closing alert
function SeerBetaClosingAlert() {
  const {isDismissed, dismiss} = useDismissAlert({
    key: 'seer-beta-closing-alert-dismissed',
  });
  const subscription = useSubscription();
  const isTouchCustomer = subscription?.type === BillingType.INVOICED;

  if (isDismissed) return null;
  if (isTouchCustomer) {
    return (
      <StyledAlert
        type="info"
        showIcon
        trailingItems={
          <Button
            aria-label="dismiss"
            icon={<IconClose />}
            onClick={dismiss}
            size="zero"
            borderless
          />
        }
      >
        <AlertBody>
          <span>
            <b>Seer beta is ending soon</b>
          </span>
          <span>
            Thanks for trying Seer. Starting June 10, Seer will require a committed budget
            to continue scanning and fixing issues. You won't be charged unless you
            actively opt in. Reach out to your account manager to learn more.
          </span>
        </AlertBody>
      </StyledAlert>
    );
  }
  return (
    <StyledAlert
      type="info"
      showIcon
      trailingItems={
        <Button
          aria-label="dismiss"
          icon={<IconClose />}
          onClick={dismiss}
          size="zero"
          borderless
        />
      }
    >
      <AlertBody>
        <span>
          <b>Seer beta is ending soon</b>
        </span>
        <span>
          Thanks for trying Seer. Starting June 10, Seer will require a $20/month
          subscription. You won't be charged unless you actively opt in to continue to use
          Seer to scan and fix issues.
        </span>
        <ExternalLink href="https://docs.sentry.io/pricing/#seer-pricing/">
          Learn more
        </ExternalLink>
      </AlertBody>
    </StyledAlert>
  );
}

export default SeerBetaClosingAlert;

const AlertBody = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
`;

const StyledAlert = styled(Alert)`
  margin-bottom: ${space(2)};
`;
