import React from 'react';
import Icon from 'react-icon-base';

function IconCloseLg(props) {
  return(
    <Icon viewBox="0 0 20 20" {...props}>
      <g stroke="currentColor" fill="none">
        <path d="M0.5,0.5 L19.5,19.5" />
        <path d="M0.5,19.5 L19.5,0.5" />
      </g>
    </Icon>
  );
}

export default IconCloseLg;
