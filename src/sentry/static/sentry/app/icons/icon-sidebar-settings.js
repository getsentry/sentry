import React from 'react';
import Icon from 'react-icon-base';

function IconSidebarUserFeedback(props) {
  return (
    <Icon viewBox="0 0 11 11" {...props}>
      <g
        strokeLinecap="round"
        strokeLinejoin="round"
        stroke="currentColor"
        strokeWidth="1"
        fill="none">
        <g transform="translate(1.000000, 1.000000)">
          <circle cx="4.5" cy="4.5" r="1" />
        </g>
        <g className="cog" opacity="0.35" transform="translate(1.000000, 1.000000)">
          <circle cx="4.5" cy="4.5" r="3" />
          <path d="M4.5,0.483613277 L4.5,1.5 M4.5,7.5 L4.5,8.54790179" />
          <path d="M1.5,7.5 L2.5,6.5 M6.5,2.5 L7.50463434,1.49536566 L7.50463434,1.49536566" />
          <path d="M1.5020254,1.5020254 L2.5,2.5 M6.55000019,6.55000019 L7.5,7.5" />
          <path d="M0.5,4.5 L1.50134277,4.5 M7.49700928,4.5 L8.5,4.5" />
        </g>
      </g>
    </Icon>
  );
}

export default IconSidebarUserFeedback;
