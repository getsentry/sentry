import React from 'react';
import styled from '@emotion/styled';

import PlatformList from 'app/components/platformList';
import space from 'app/styles/space';

export default {
  title: 'UI/Platform List',
  component: PlatformList,
};

const platforms = ['java', 'php', 'javascript', 'cocoa', 'ruby'];

export const _PlatformList = ({...args}) => (
  <Wrapper>
    <PlatformList {...args} />
  </Wrapper>
);

_PlatformList.storyName = 'PlatformList';
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
