import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Container, type ContainerProps} from '@sentry/scraps/layout';

import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';

// This is required to offer components that sit between this settings header
// and i.e. dropdowns, some zIndex layer room
//
// e.g. app/views/settings/metric/triggers/chart/
const HEADER_Z_INDEX_OFFSET = 5;

export const SettingsHeader = styled((props: ContainerProps<'div'>) => {
  const theme = useTheme();
  const hasPageFrame = useHasPageFrameFeature();

  return (
    <Container
      top="0"
      position="sticky"
      borderBottom="primary"
      background="primary"
      style={{zIndex: theme.zIndex.header + HEADER_Z_INDEX_OFFSET}}
      padding={hasPageFrame ? {sm: 'sm lg', md: 'md xl'} : 'xl 3xl'}
      radius={hasPageFrame ? 'lg 0 0 0' : undefined}
      {...props}
    />
  );
})``;
