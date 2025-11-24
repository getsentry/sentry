import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {Tooltip} from 'sentry/components/core/tooltip';
import {IconCheckmark, IconSubtract} from 'sentry/icons';
import {space} from 'sentry/styles/space';

import type {Policy} from 'getsentry/types';

type PolicyStatusProps = {
  policy: Policy;
};

type StatusIconProps = {
  icon: React.ReactNode;
  tooltip: string;
};

export function StatusIconWithTooltip({icon, tooltip}: StatusIconProps) {
  return (
    <Tooltip title={tooltip}>
      <PolicyStatusIcon>{icon}</PolicyStatusIcon>
    </Tooltip>
  );
}

export function PolicyStatus({policy}: PolicyStatusProps) {
  if (!policy.hasSignature) {
    return (
      <StatusIconWithTooltip
        tooltip="Included with all accounts"
        icon={<IconCheckmark size="sm" color="success" />}
      />
    );
  }

  if (policy.consent) {
    return (
      <StatusIconWithTooltip
        tooltip={`Signed by ${policy.consent.userEmail} on ${moment(
          policy.consent.createdAt
        ).format('ll')}`}
        icon={<IconCheckmark size="sm" color="success" />}
      />
    );
  }

  return (
    <StatusIconWithTooltip
      tooltip="Optional, not signed"
      icon={<IconSubtract color="gray500" size="sm" />}
    />
  );
}

const PolicyStatusIcon = styled('div')`
  display: flex;
  height: 100%;
  align-items: center;
  padding: ${space(1)};
`;
