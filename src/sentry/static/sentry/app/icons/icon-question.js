import React from 'react';
import Icon from 'react-icon-base';

function IconQuestion(props) {
  return(
    <Icon viewBox="0 0 15 15" {...props}>
      <g id="icon-question">
          <circle stroke="currentColor" id="question-mark-oval" cx="7.5" cy="7.5" r="7" />
          <path stroke="currentColor" d="M7.5,10.5 L7.5,11.5" id="question-mark-bottom" strokeLinecap="round" strokeLinejoin="round" />
          <path stroke="currentColor" d="M7.5,8.5 L7.5,7.5 C8.40730262,6.88947344 9.5,6.5867658 9.5,5.48853065 C9.5,4.3902955 8.6045695,3.5 7.5,3.5 C6.3954305,3.5 5.5,4.3902955 5.5,5.48853065" id="question-mark-top" strokeLinecap="round" strokLinejoin="round" />
      </g>
    </Icon>
  );
}

export default IconQuestion;
