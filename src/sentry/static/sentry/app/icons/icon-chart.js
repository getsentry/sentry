import React from 'react';
import Icon from 'react-icon-base';

function IconChart(props) {
  return(
    <Icon viewBox="0 0 15 15" {...props}>
      <g id="icon-stream" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <rect x="0.5" y="2.5" width="2" height="10" rx="1" />
        <rect x="4.5" y="6.5" width="2" height="6" rx="1" />
        <rect x="8.5" y="4.5" width="2" height="8" rx="1" />
        <rect x="12.5" y="8.5" width="2" height="4" rx="1" />
      </g>
    </Icon>
  );
}

export default IconChart;
