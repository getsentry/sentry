import React from 'react';
import Icon from 'react-icon-base';

function IconSidebarIssues(props) {
  return (
    <Icon viewBox="0 0 11 11" {...props}>
      <circle fill="currentColor" cx="2" cy="3" r="1" />
      <circle fill="currentColor" cx="2" cy="7" r="1" />
      <path
        d="M4.5,2.5 L9.5,2.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1"
      />
      <path
        d="M4.5,4.5 L7.5,4.5"
        stroke="currentColor"
        opacity="0.3"
        strokeLinecap="round"
        strokeWidth="1"
      />
      <path
        d="M4.5,6.5 L8.5,6.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1"
      />
      <path
        d="M4.5,8.5 L6.5,8.5"
        stroke="currentColor"
        opacity="0.3"
        strokeLinecap="round"
        strokeWidth="1"
      />
    </Icon>
  );
}

export default IconSidebarIssues;
