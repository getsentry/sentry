import {useTheme, type Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import CircleIndicator from 'sentry/components/circleIndicator';
import {space} from 'sentry/styles/space';
import type {IntegrationInstallationStatus} from 'sentry/types/integrations';
import {
  DISABLED,
  INSTALLED,
  NOT_INSTALLED,
  PENDING,
  PENDING_DELETION,
} from 'sentry/views/settings/organizationIntegrations/constants';

const LEARN_MORE = 'Learn More';
const COLORS = {
  [INSTALLED]: 'success',
  [NOT_INSTALLED]: 'secondary',
  [DISABLED]: 'secondary',
  [PENDING_DELETION]: 'secondary',
  [PENDING]: 'promotion',
  [LEARN_MORE]: 'primary',
} as const satisfies Record<string, keyof Theme['tokens']['content']>;

type StatusProps = {
  status: IntegrationInstallationStatus;
};

const IntegrationStatus = styled(({status, ...p}: StatusProps) => {
  const theme = useTheme();

  return (
    <Flex align="center">
      <CircleIndicator size={6} color={theme.tokens.content[COLORS[status]]} />
      <div {...p}>{status}</div>
    </Flex>
  );
})`
  color: ${p => p.theme.tokens.content[COLORS[p.status]]};
  margin-left: ${space(0.5)};
  font-weight: light;
  margin-right: ${space(0.75)};
`;

export default IntegrationStatus;
