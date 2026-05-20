import styled from '@emotion/styled';

import {Container, type ContainerProps} from '@sentry/scraps/layout';

import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';

export const SettingsHeader = styled((props: ContainerProps) => {
  const hasPageFrame = useHasPageFrameFeature();

  return (
    <Container
      top="0"
      position="sticky"
      borderBottom="primary"
      background="primary"
      style={{zIndex: 1}}
      padding={hasPageFrame ? {sm: 'sm lg', md: 'md xl'} : 'xl 3xl'}
      radius={hasPageFrame ? 'lg 0 0 0' : undefined}
      {...props}
    />
  );
})``;
