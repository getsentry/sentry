import styled from '@emotion/styled';

import PlatformList from 'sentry/components/platformList';
import space from 'sentry/styles/space';

export default {
  title: 'Assets/Platforms/Platform List',
  component: PlatformList,
};

const platforms = ['java', 'php', 'javascript', 'cocoa', 'ruby'];

export const _PlatformList = ({...args}) => (
  <Wrapper>
    <PlatformList {...args} />
  </Wrapper>
);

_PlatformList.storyName = 'Platform List';
_PlatformList.args = {
  platforms,
  showCounter: false,
  max: platforms.length,
  size: 28,
};

const Wrapper = styled('div')`
  padding: ${space(3)};
  background: ${p => p.theme.white};
  display: flex;
`;
