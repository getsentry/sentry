import styled from '@emotion/styled';

import EventMessage from 'sentry/components/events/eventMessage';
import overflowEllipsis from 'sentry/styles/overflowEllipsis';
import space from 'sentry/styles/space';
import {Group} from 'sentry/types';

import UnhandledTag, {
  TagAndMessageWrapper,
} from '../organizationGroupDetails/unhandledTag';

type Props = {
  group: Group;
};

const SharedGroupHeader = ({group}: Props) => (
  <Wrapper>
    <Details>
      <Title>{group.title}</Title>
      <TagAndMessageWrapper>
        {group.isUnhandled && <UnhandledTag />}
        <EventMessage message={group.culprit} />
      </TagAndMessageWrapper>
    </Details>
  </Wrapper>
);

export default SharedGroupHeader;

const Wrapper = styled('div')`
  padding: ${space(3)} ${space(4)} ${space(3)} ${space(4)};
  border-bottom: ${p => `1px solid ${p.theme.border}`};
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.03);
  position: relative;
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
