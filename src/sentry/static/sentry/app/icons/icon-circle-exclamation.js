import React from 'react';
import Icon from 'react-icon-base';

function IconCircleExclamation(props) {
  return (
    <Icon viewBox="0 0 15 15" {...props}>
      <g stroke="currentColor" fill="none" strokeLinejoin="round" strokeLinecap="round">
        <circle cx="7.5" cy="7.5" r="7" />
        <path d="M7.5,3.5 L7.5,8.5" />
        <path d="M7.5,10.5 L7.5,11.5" />
      </g>
    </Icon>
  );
}

export default IconCircleExclamation;
