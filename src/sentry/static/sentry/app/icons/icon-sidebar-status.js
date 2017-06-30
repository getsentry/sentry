import React from 'react';
import Icon from 'react-icon-base';

function IconSidebarStatus(props) {
  return (
    <Icon viewBox="0 0 11 11" {...props}>
      <defs>
        <linearGradient
          x1="26.2198547%"
          y1="5.50040322%"
          x2="92.1501024%"
          y2="82.6365573%"
          id="linearGradient-1">
          <stop stopColor="#F9A66D" offset="0%" />
          <stop stopColor="#F36E4F" offset="100%" />
        </linearGradient>
      </defs>
      <g
        strokeLinecap="round"
        strokeLinejoin="round"
        stroke="currentColor"
        strokeWidth="1"
        fill="none">
        <path d="M5.5,3.5 L5.5,5.5" stroke="#F9A66D" />
        <circle fill="#F9A66D" cx="5.5" cy="7.5" r=".55" strokeWidth="0" />
        <circle stroke="url(#linearGradient-1)" cx="5.5" cy="5.5" r="4" />
      </g>
    </Icon>
  );
}

export default IconSidebarStatus;
