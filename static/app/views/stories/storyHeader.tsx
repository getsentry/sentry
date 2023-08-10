import {ComponentProps} from 'react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/profiling/flex';
import ThemeSwitcher from 'sentry/components/stories/themeSwitcher';
import {space} from 'sentry/styles/space';

interface Props extends ComponentProps<'div'> {}

export default function StoryHeader({style}: Props) {
  return (
    <Flex justify="space-between" gap={space(2)} style={style}>
      <H1>Sentry UI System</H1>
      <ThemeSwitcher />
    </Flex>
  );
}

const H1 = styled('h1')`
  margin: 0;
  width: auto;
`;
