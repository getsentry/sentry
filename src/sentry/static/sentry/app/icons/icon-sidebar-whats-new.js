import React from 'react';
import Icon from 'react-icon-base';

function IconSidebarWhatsNew(props) {
  return (
    <Icon viewBox="0 0 11 11" {...props}>
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M1.5,4.5 C1.5,3.94771525 1.94266033,3.5 2.49895656,3.5 L4.5,3.5 L4.5,5.5 L2.49895656,5.5 C1.94724809,5.5 1.5,5.05613518 1.5,4.5 Z" />
        <path
          d="M4.5,3.5 C6.61653842,3.5 8.5,1.5 8.5,1.5 L8.5,7.5 C8.5,7.5 6.61653842,5.5 4.5,5.5 L4.5,3.5 Z"
          opacity="0.3"
        />
        <path d="M9.5,3.5 L9.5,5.5" id="Line" strokeLinecap="round" />
        <polyline opacity="0.3" points="4.5 5.5 5.5 8.5 3.5 8.5 2.5 5.5" />
      </g>
    </Icon>
  );
}

export default IconSidebarWhatsNew;
