import React from 'react';
import styled from '@emotion/styled';

type Props = {
  /**
   * The value of the progress indicator for the determinate variant. Value between 0 and 100
   */
  value: number;
  /**
   * Styles applied to the component's root
   */
  className?: string;
};

const ProgressBar = styled(({className, value}: Props) => (
  <div
    role="progressbar"
    aria-valuenow={value}
    aria-valuemin={0}
    aria-valuemax={100}
    className={className}
  />
))`
  background: ${p => p.theme.gray100};
  border-radius: 100px;
  height: 6px;
  width: 100%;
  overflow: hidden;
  position: relative;
  :before {
    content: ' ';
    width: ${p => p.value}%;
    height: 100%;
    background-color: ${p => p.theme.purple300};
    position: absolute;
    top: 0;
    left: 0;
  }
`;

export default ProgressBar;
