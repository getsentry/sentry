import React from 'react';
import styled from 'react-emotion';
import InlineSvg from 'app/components/inlineSvg';

/* styles common to the guide and support cue/drawer. */
const AssistantContainer = styled('div')`
  position: fixed;
  z-index: ${p => p.theme.zIndex.modal};
  width: 25vw;
  max-width: 450px;
  min-width: 300px;
  bottom: 1vw;
  border-radius: 1.45em;
  font-weight: bold;
  box-shadow: ${p => p.theme.dropShadowHeavy};
`;

const CueContainer = styled(AssistantContainer)`
  display: flex;
  align-items: center;
  cursor: pointer;
  max-width: none;
  min-width: 0;
  width: auto;
  height: 2.75em;
`;

const CueIcon = styled(({hasGuide, ...props}) => (
  <InlineSvg
    src={hasGuide ? 'icon-circle-exclamation' : 'icon-circle-question'}
    {...props}
  />
))`
  width: 2.75em;
  height: 2.75em;
  color: ${p => (p.hasGuide ? p.theme.greenLight : p.theme.purple)};
`;

const CloseIcon = styled(props => <InlineSvg src="icon-close-lg" {...props} />)`
  stroke-width: 3px;
  width: 0.75em;
  height: 0.75em;
  margin: 0 0.875em 0 0.66em;
  cursor: pointer;
`;

const CueText = styled('span')`
  overflow: hidden;
  transition: 0.2s all;
  white-space: nowrap;
`;

export {AssistantContainer, CueContainer, CueIcon, CueText, CloseIcon};
