import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Container, type ContainerProps} from '@sentry/scraps/layout';

const HEADER_Z_INDEX_OFFSET = 5;

export const SettingsHeader = styled((props: ContainerProps) => {
  const theme = useTheme();

  return (
    <Container
      top="0"
      position="sticky"
      borderBottom="primary"
      background="primary"
      style={{zIndex: theme.zIndex.header + HEADER_Z_INDEX_OFFSET}}
      padding={{sm: 'sm lg', md: 'md xl'}}
      radius="lg 0 0 0"
      {...props}
    />
  );
})``;
