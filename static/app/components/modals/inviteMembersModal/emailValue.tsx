import type {MultiValueProps, OptionTypeBase} from 'react-select';
import {components as selectComponents} from 'react-select';
import styled from '@emotion/styled';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Tooltip} from 'sentry/components/tooltip';
import {IconCheckmark, IconWarning} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';

import type {InviteStatus} from './types';

function EmailValue<Option extends OptionTypeBase>({
  status,
  valueProps,
}: {
  status: InviteStatus[string];
  valueProps: MultiValueProps<Option>;
}) {
  const organization = useOrganization();
  const {children, ...props} = valueProps;
  const error = status?.error;

  const emailLabel =
    status === undefined ? (
      children
    ) : (
      <Tooltip disabled={!error} title={error}>
        <EmailLabel>
          {children}
          {!status.sent && !status.error && <SendingIndicator />}
          {status.error && <IconWarning legacySize="10px" />}
          {status.sent && !organization.features.includes('invite-members-new-modal') && (
            <IconCheckmark legacySize="10px" color="success" />
          )}
        </EmailLabel>
      </Tooltip>
    );

  return (
    <selectComponents.MultiValue {...props}>{emailLabel}</selectComponents.MultiValue>
  );
}

const EmailLabel = styled('div')`
  display: inline-grid;
  grid-auto-flow: column;
  gap: ${space(0.5)};
  align-items: center;
`;

const SendingIndicator = styled(LoadingIndicator)`
  margin: 0;
  .loading-indicator {
    border-width: 2px;
  }
`;

SendingIndicator.defaultProps = {
  hideMessage: true,
  size: 14,
};

export default EmailValue;
