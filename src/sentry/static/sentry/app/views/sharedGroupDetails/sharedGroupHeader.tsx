import React from 'react';
import styled from '@emotion/styled';

import EventMessage from 'app/components/events/eventMessage';
import space from 'app/styles/space';
import {Group} from 'app/types';
import overflowEllipsis from 'app/styles/overflowEllipsis';

import {LabelAndMessageWrapper, UnhandledLabel} from '../organizationGroupDetails/styles';

type Props = {
  group: Group;
};

const SharedGroupHeader = ({group}: Props) => (
  <Wrapper>
    <Details>
      <Title>{group.title}</Title>
      <LabelAndMessageWrapper>
        {(true || (group as any).isUnhandled) && <UnhandledLabel />}
        <EventMessage message={group.culprit} />
      </LabelAndMessageWrapper>
    </Details>
  </Wrapper>
);

export default SharedGroupHeader;

const Wrapper = styled('div')`
  padding: ${space(3)} ${space(4)} ${space(3)} ${space(4)};
  border-bottom: ${p => `1px solid ${p.theme.borderLight}`};
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.03);
  position: relative;
  margin: 0 0 ${space(3)};
`;

const Details = styled('div')`
  max-width: 960px;
  margin: 0 auto;
`;

// TODO(style): the color #161319 is not yet in the color object of the theme
const Title = styled('h3')`
  color: #161319;
  margin: 0 0 ${space(1)};
  overflow-wrap: break-word;
  line-height: 1.2;
  font-size: ${p => p.theme.fontSizeExtraLarge};
  @media (min-width: ${props => props.theme.breakpoints[0]}) {
    font-size: ${p => p.theme.headerFontSize};
    line-height: 1.1;
    ${overflowEllipsis};
  }
`;
