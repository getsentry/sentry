import type {ComponentProps} from 'react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/container/flex';
import ThemeSwitcher from 'sentry/components/stories/themeSwitcher';
import {IconSentry} from 'sentry/icons';
import {space} from 'sentry/styles/space';

interface Props extends ComponentProps<'div'> {}

export default function StoryHeader(props: Props) {
  return (
    <Flex as="header" justify="space-between" gap={space(2)} {...props}>
      <H1>
        <IconSentry size="xl" /> Component Library
      </H1>
      <ThemeSwitcher />
    </Flex>
  );
}

const H1 = styled('h1')`
  margin: 0;

  display: flex;
  gap: ${space(1)};
  align-items: center;
`;
