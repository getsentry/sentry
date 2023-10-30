import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/tooltip';
import {IconCheckmark, IconCircle, IconFlag} from 'sentry/icons';
import {space} from 'sentry/styles/space';

type Props = {
  status: 'error' | 'success' | 'empty';
  tooltip?: string;
};

function PackageStatus({status, tooltip}: Props) {
  const getIcon = () => {
    switch (status) {
      case 'success':
        return <IconCheckmark isCircled color="successText" size="xs" />;
      case 'empty':
        return <IconCircle size="xs" />;
      case 'error':
      default:
        return <IconFlag color="errorText" size="xs" />;
    }
  };

  const icon = getIcon();

  if (status === 'empty') {
    return null;
  }

  return (
    <StyledTooltip
      title={tooltip}
      disabled={!(tooltip && tooltip.length)}
      containerDisplayMode="inline-flex"
    >
      <PackageStatusIcon>{icon}</PackageStatusIcon>
    </StyledTooltip>
  );
}

const StyledTooltip = styled(Tooltip)`
  margin-left: ${space(0.75)};
`;

export const PackageStatusIcon = styled('span')`
  height: 12px;
  align-items: center;
  cursor: pointer;
  visibility: hidden;
  display: none;
  @media (min-width: ${p => p.theme.breakpoints.small}) {
    display: block;
  }
`;

export default PackageStatus;
