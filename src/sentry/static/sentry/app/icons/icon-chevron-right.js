import React from 'react';
import Icon from 'react-icon-base';

function IconChevronRight(props) {
  return (
    <Icon viewBox="0 0 15 15" {...props}>
      <g
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="4.5 0.5 10.5 7.5 4.5 14.5" />
      </g>
    </Icon>
  );
}

export default IconChevronRight;
