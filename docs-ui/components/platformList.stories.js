import React from 'react';
import styled from '@emotion/styled';
import {withInfo} from '@storybook/addon-info';
import {boolean, number} from '@storybook/addon-knobs';

import PlatformList from 'app/components/platformList';
import space from 'app/styles/space';

export default {
  title: 'UI/Platform List',
};

const platforms = ['java', 'php', 'javascript', 'cocoa', 'ruby'];

export const _PlatformList = withInfo('Stacked list of platform and framework icons')(
  () => (
    <Wrapper>
      <PlatformList
        platforms={platforms}
        showCounter={boolean('Show Counter', false)}
        max={number('Max', platforms.length)}
        size={number('Size', 28)}
      />
    </Wrapper>
  )
);

_PlatformList.story = {
  name: 'PlatformList',
};

const Wrapper = styled('div')`
  padding: ${space(3)};
  background: ${p => p.theme.white};
  display: flex;
`;
