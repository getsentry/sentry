import React from 'react';
import Icon from 'react-icon-base';

function IconSidebarHistory(props) {
  return (
    <Icon viewBox="0 0 11 11" {...props}>
      <g id="Page-1" stroke="none" strokeWidth="1" fill="none" fillRule="evenodd">
        <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
          <circle className="clock" opacity="0.3" cx="5.5" cy="5.5" r="4" />
          <path className="clock-big-hand" d="M5.5,3.5 L5.5,5.5" />
          <path className="clock-little-hand" d="M5.5,5.5 L6.5,6.5" />
        </g>
      </g>
    </Icon>
  );
}

export default IconSidebarHistory;
