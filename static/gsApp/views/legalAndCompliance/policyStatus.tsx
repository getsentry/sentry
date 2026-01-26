import moment from 'moment-timezone';

import {Flex} from '@sentry/scraps/layout';

import {Tooltip} from 'sentry/components/core/tooltip';
import {IconCheckmark, IconSubtract} from 'sentry/icons';

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
      <Flex align="center" padding="md" height="100%">
        {icon}
      </Flex>
    </Tooltip>
  );
}

export function PolicyStatus({policy}: PolicyStatusProps) {
  if (!policy.hasSignature) {
    return (
      <StatusIconWithTooltip
        tooltip="Included with all accounts"
        icon={<IconCheckmark size="sm" variant="success" />}
      />
    );
  }

  if (policy.consent) {
    return (
      <StatusIconWithTooltip
        tooltip={`Signed by ${policy.consent.userEmail} on ${moment(
          policy.consent.createdAt
        ).format('ll')}`}
        icon={<IconCheckmark size="sm" variant="success" />}
      />
    );
  }

  return (
    <StatusIconWithTooltip
      tooltip="Optional, not signed"
      icon={<IconSubtract variant="primary" size="sm" />}
    />
  );
}
