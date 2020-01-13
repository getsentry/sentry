import React from 'react';
import styled from '@emotion/styled';

import InlineSvg from 'app/components/inlineSvg';
import Tooltip from 'app/components/tooltip';
import space from 'app/styles/space';

type Props = {
  status: 'error' | 'success' | 'empty';
  tooltip?: string;
};

class PackageStatus extends React.Component<Props> {
  getIconTypeAndSource(
    status: Props['status']
  ): {iconType: PackageStatusIconProps['type']; iconSrc: string} {
    switch (status) {
      case 'success':
        return {iconType: 'success', iconSrc: 'icon-circle-check'};
      case 'empty':
        return {iconType: 'muted', iconSrc: 'icon-circle-empty'};
      case 'error':
      default:
        return {iconType: 'error', iconSrc: 'icon-circle-exclamation'};
    }
  }

  render() {
    const {status, tooltip} = this.props;

    const {iconType, iconSrc} = this.getIconTypeAndSource(status);

    if (status === 'empty') {
      return null;
    }

    return (
      <Tooltip title={tooltip} disabled={!(tooltip && tooltip.length)}>
        <PackageStatusIcon type={iconType} src={iconSrc} size="1em" />
      </Tooltip>
    );
  }
}

type PackageStatusIconProps = {
  type: 'error' | 'success' | 'muted';
};
export const PackageStatusIcon = styled(InlineSvg)<PackageStatusIconProps>`
  color: ${p => p.theme.alert[p.type!].iconColor};
  margin-left: ${space(0.5)};
  opacity: 0;
`;

export default PackageStatus;
