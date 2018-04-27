import React from 'react';
import styled from 'react-emotion';
import InlineSvg from 'app/components/inlineSvg';

const QuestionMarkIcon = styled(({hasGuide, ...props}) => (
  <InlineSvg
    src={hasGuide ? 'icon-circle-exclamation' : 'icon-circle-question'}
    {...props}
  />
))`
  width: 2.75em;
  height: 2.75em;
  color: ${p => (p.hasGuide ? p.theme.greenLight : p.theme.purple)};
`;

export default QuestionMarkIcon;
