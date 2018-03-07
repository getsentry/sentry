import React from 'react';
import styled from 'react-emotion';
import InlineSvg from '../../components/inlineSvg';

const QuestionMarkIcon = styled(({hasGuide, ...props}) => (
  <InlineSvg
    src={hasGuide ? 'icon-circle-exclamation' : 'icon-circle-question'}
    {...props}
  />
))`
  width: 2.75em;
  height: 2.75em;
`;

export default QuestionMarkIcon;
