import React from 'react';
import styled from 'react-emotion';
import InlineSvg from '../../components/inlineSvg';

const QuestionMarkIcon = styled(props => (
  <InlineSvg src="icon-circle-question" {...props} />
))`
  width: 2.75em;
  height: 2.75em;
`;

export default QuestionMarkIcon;
