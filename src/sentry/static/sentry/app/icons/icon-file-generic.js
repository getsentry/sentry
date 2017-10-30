import React from 'react';
import Icon from 'react-icon-base';

function IconFileGeneric(props) {
  return (
    <Icon viewBox="0 0 15 15" {...props}>
      <g stroke="currentColor" fill="none">
        <path
          d="M13.5,3.5 L13.5,12.9968907 C13.5,13.827035 12.8204455,14.5 12.0044548,14.5 L2.99554521,14.5 C2.1695784,14.5 1.5,13.8247509 1.5,13.0017548 L1.5,1.99824524 C1.5,1.17078724 2.17667683,0.5 3.00687434,0.5 L10.502848,0.5 L13.5,3.5 Z"
          id="file"
          strokeLinejoin="round"
        />
        <path d="M10.5,0.5 L10.5,3.5" id="line-1" />
        <path d="M13.5,3.5 L10.5,3.5" id="line-2" />
        <path d="M4.5,4.5 L7.5,4.5" id="line-3" strokeLinejoin="round" />
        <path d="M4.5,7.5 L10.5,7.5" id="line-4" strokeLinejoin="round" />
        <path d="M4.5,10.5 L10.5,10.5" id="line-5" strokeLinejoin="round" />
      </g>
    </Icon>
  );
}

export default IconFileGeneric;
