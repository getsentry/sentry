import React from 'react';
import styled from 'react-emotion';
import InlineSvg from '../../../../components/inlineSvg';

const submitOnReturnButtonStyles = p => `
  background: transparent;
  box-shadow: none;
  border: 1px solid transparent;
  border-radius: ${p.theme.borderRadius};
  transition: 0.2s all;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 1.4em;
  width: 1.4em;

  &:hover {
    cursor: pointer;
    background: #fff;
    box-shadow: ${p.theme.dropShadowLight};
    border: 1px solid ${p.theme.borderLight};
  }
`;

const SubmitOnReturnButton = styled(props => {
  return (
    <div {...props}>
      <InlineSvg size="0.75em" src="icon-return-key" />
    </div>
  );
})`
  ${submitOnReturnButtonStyles};
`;

export default SubmitOnReturnButton;
