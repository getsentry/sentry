import React from 'react';
import {Value} from 'react-select-legacy';
import {css} from '@emotion/core';
import styled from '@emotion/styled';

import LoadingIndicator from 'app/components/loadingIndicator';
import Tooltip from 'app/components/tooltip';
import {IconCheckmark, IconWarning} from 'app/icons';
import space from 'app/styles/space';

import {InviteStatus} from './types';

function renderEmailValue(status: InviteStatus[string], valueProps) {
  const {children, ...props} = valueProps;
  const error = status && status.error;

  const emailLabel =
    status === undefined ? (
      children
    ) : (
      <Tooltip disabled={!error} title={error}>
        <EmailLabel>
          {children}
          {!status.sent && !status.error && <SendingIndicator />}
          {status.error && <IconWarning size="10px" />}
          {status.sent && <IconCheckmark size="10px" />}
        </EmailLabel>
      </Tooltip>
    );

  return (
    <EmailValue status={status}>
      <Value {...props}>{emailLabel}</Value>
    </EmailValue>
  );
}

const EmailValue = styled('div')<{status: InviteStatus[string]}>`
  display: initial;

  .Select--multi.is-disabled & .Select-value {
    ${p =>
      p.status &&
      p.status.error &&
      css`
        color: ${p.theme.red300};
        border-color: ${p.theme.red300};
        background-color: ${p.theme.red100};
      `};
  }

  .Select-value svg {
    color: ${p => (p.status && p.status.sent ? p.theme.green300 : 'inherit')};
  }
`;

const EmailLabel = styled('div')`
  display: inline-grid;
  grid-auto-flow: column;
  grid-gap: ${space(0.5)};
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

export default renderEmailValue;
