import styled from '@emotion/styled';
import {IconWarning} from '@sentry/icons/warning';

import {Grid} from '@sentry/scraps/layout';
import type {MultiValueProps, OptionTypeBase} from '@sentry/scraps/select';
import {components as selectComponents} from '@sentry/scraps/select';
import {Tooltip} from '@sentry/scraps/tooltip';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';

import type {InviteStatus} from './types';

export function EmailValue<Option extends OptionTypeBase>({
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
        <Grid display="inline-grid" align="center" gap="xs" flow="column">
          {children}
          {!status.sent && !status.error && <SendingIndicator size={14} />}
          {status.error && <IconWarning legacySize="10px" />}
        </Grid>
      </Tooltip>
    );

  return (
    <selectComponents.MultiValue {...props}>{emailLabel}</selectComponents.MultiValue>
  );
}

const SendingIndicator = styled(LoadingIndicator)`
  margin: 0;
  .loading-indicator {
    border-width: 2px;
  }
`;
