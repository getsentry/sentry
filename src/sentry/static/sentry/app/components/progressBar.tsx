import React from 'react';
import styled from '@emotion/styled';

import Tooltip from 'app/components/tooltip';
import {Color} from 'app/utils/theme';

type Props = {
  /**
   * The value of the progress indicator for the determinate variant. Value between 0 and 100
   */
  value: number;
  /**
   * The color of the component.
   */
  progressColor?: Color;
  /**
   * Text to show up on a hover.
   */
  tooltipText?: React.ComponentProps<typeof Tooltip>['title'];
  /**
   * Styles applied to the component's root
   */
  className?: string;
};

const ProgressBar = styled(({className, tooltipText}: Props) => {
  const content = <div className={className} />;

  if (tooltipText) {
    return <Tooltip title={tooltipText}>{content}</Tooltip>;
  }

  return content;
})`
  background: ${p => p.theme.gray100};
  border-radius: 100px;
  height: 6px;
  width: 100%;
  overflow: hidden;
  position: relative;
  :before {
    content: ' ';
    width: ${p => p.value ?? 0}%;
    height: 100%;
    background-color: ${p => p.progressColor ?? p.theme.purple300};
    position: absolute;
    top: 0;
    left: 0;
  }
`;

export default ProgressBar;
