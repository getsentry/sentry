import styled from '@emotion/styled';
import {IconWarning} from '@sentry/icons/warning';

import {Grid} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';

import type {InviteStatus} from './types';

export function EmailValue({
  status,
  children,
}: {
  children: React.ReactNode;
  status: InviteStatus[string];
}) {
  const error = status?.error;

  const emailLabel =
    status === undefined ? (
      children
    ) : (
      <Tooltip disabled={!error} title={error}>
        <Grid display="inline-grid" align="center" gap="xs" flow="column">
          {children}
          {!status.sent && !status.error && <SendingIndicator size={14} />}
          {status.error && <IconWarning legacySize="10px" />}
        </Grid>
      </Tooltip>
    );

  return emailLabel;
}

const SendingIndicator = styled(LoadingIndicator)`
  margin: 0;
  .scraps-spinner-ring {
    border-width: 2px;
  }
`;
