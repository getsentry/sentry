import React from 'react';
import styled from 'react-emotion';

import InlineSvg from 'app/components/inlineSvg';
import Tooltip from 'app/components/tooltip';
import space from 'app/styles/space';

type Props = {
  isError: boolean;
  tooltip?: string;
};

class PackageStatus extends React.Component<Props> {
  render() {
    const {isError, tooltip} = this.props;

    const iconType = isError ? 'error' : 'success';
    const iconSrc = isError ? 'icon-circle-exclamation' : 'icon-circle-check';

    return (
      <Tooltip title={tooltip} disabled={!(tooltip && tooltip.length)}>
        <PackageStatusIcon type={iconType} src={iconSrc} size="1em" />
      </Tooltip>
    );
  }
}

type PackageStatusIconProps = {
  type: 'error' | 'success';
};
export const PackageStatusIcon = styled(InlineSvg)<PackageStatusIconProps>`
  color: ${p => p.theme.alert[p.type!].iconColor};
  margin-left: ${space(0.5)};
  opacity: 0;
`;

export default PackageStatus;
