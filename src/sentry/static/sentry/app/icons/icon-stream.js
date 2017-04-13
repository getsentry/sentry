import React from 'react';
import Icon from 'react-icon-base';

function IconStream(props) {
  return(
    <Icon viewBox="0 0 15 15" {...props}>
      <g id="icon-stream" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M4.5,9.5 L14.5,9.5" />
        <path d="M4.5,11.5 L6.5,11.5" opacity="0.6" />
        <path d="M8.5,11.5 L11.5,11.5" opacity="0.3" />
        <path d="M4.5,3.5 L14.5,3.5" />
        <path d="M4.5,5.5 L6.5,5.5" opacity="0.6" />
        <path d="M8.5,5.5 L10.5,5.5" opacity="0.3" />
        <path d="M12.5,5.5 L13.5,5.5" opacity="0.3" />
        <circle id="Oval-6" cx="1.5" cy="10.5" r="1"/>
        <circle id="Oval-6" cx="1.5" cy="4.5" r="1" />
      </g>
    </Icon>
  );
}

export default IconStream;
