import styled from '@emotion/styled';

import type {
  MultiValueProps,
  OptionTypeBase,
} from 'sentry/components/forms/controls/reactSelectWrapper';
import {components as selectComponents} from 'sentry/components/forms/controls/reactSelectWrapper';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Tooltip} from 'sentry/components/tooltip';
import {IconWarning} from 'sentry/icons';
import {space} from 'sentry/styles/space';

import type {InviteStatus} from './types';

function EmailValue<Option extends OptionTypeBase>({
  status,
  valueProps,
}: {
  status: InviteStatus[string];
  valueProps: MultiValueProps<Option>;
}) {
  const {children, ...props} = valueProps;
  const error = status?.error;

  const emailLabel =
    status === undefined ? (
      children
    ) : (
      <Tooltip disabled={!error} title={error}>
        <EmailLabel>
          {children}
          {!status.sent && !status.error && <SendingIndicator hideMessage size={14} />}
          {status.error && <IconWarning legacySize="10px" />}
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

export default EmailValue;
