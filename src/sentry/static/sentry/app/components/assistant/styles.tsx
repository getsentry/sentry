import React from 'react';
import styled from '@emotion/styled';

import InlineSvg from 'app/components/inlineSvg';
import space from 'app/styles/space';

/* styles common to the guide and support cue/drawer. */
const AssistantContainer = styled('div')`
  position: fixed;
  z-index: ${p => p.theme.zIndex.modal};
  width: 25vw;
  max-width: 450px;
  min-width: 300px;
  min-height: 40px;
  bottom: 1vw;
  border-radius: ${p => p.theme.borderRadius};
  box-shadow: ${p => p.theme.dropShadowHeavy};
  padding: ${space(2)};
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

type CueIconProps = React.ComponentPropsWithoutRef<typeof InlineSvg> & {
  hasGuide: boolean;
};

const CueIcon = styled(({hasGuide, ...props}: CueIconProps) => (
  <InlineSvg
    src={hasGuide ? 'icon-circle-exclamation' : 'icon-circle-question'}
    {...props}
  />
))`
  width: 1.33em;
  height: 1.33em;
`;

const CloseIcon = styled(props => <InlineSvg src="icon-close-lg" {...props} />)`
  stroke-width: 3px;
  width: 0.75em;
  height: 0.75em;
  margin: 0 0 0 ${space(1.5)};
  cursor: pointer;
`;

const CueText = styled('span')`
  overflow: hidden;
  transition: 0.2s all;
  white-space: nowrap;
`;

export {AssistantContainer, CueContainer, CueIcon, CueText, CloseIcon};
