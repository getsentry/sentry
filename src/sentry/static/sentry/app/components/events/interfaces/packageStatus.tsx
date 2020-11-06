import React from 'react';
import styled from '@emotion/styled';

import {IconCircle, IconCheckmark, IconFlag} from 'app/icons';
import Tooltip from 'app/components/tooltip';
import space from 'app/styles/space';

type Props = {
  status: 'error' | 'success' | 'empty';
  tooltip?: string;
};

const PackageStatus = ({status, tooltip}: Props) => {
  const getIcon = () => {
    switch (status) {
      case 'success':
        return <IconCheckmark isCircled color="green300" size="xs" />;
      case 'empty':
        return <IconCircle size="xs" />;
      case 'error':
      default:
        return <IconFlag color="red300" size="xs" />;
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
};

const StyledTooltip = styled(Tooltip)`
  margin-left: ${space(0.75)};
`;

export const PackageStatusIcon = styled('span')`
  height: 12px;
  align-items: center;
  cursor: pointer;
  visibility: hidden;
  display: none;
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    display: block;
  }
`;

export default PackageStatus;
