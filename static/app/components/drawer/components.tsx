import {useTheme} from '@emotion/react';

import {
  DrawerHeader as BaseDrawerHeader,
  DrawerPanel as BaseDrawerPanel,
  type DrawerHeaderProps,
  type DrawerPanelProps,
} from '@sentry/scraps/drawer';

import {useMedia} from 'sentry/utils/useMedia';
import {PRIMARY_HEADER_HEIGHT} from 'sentry/views/navigation/constants';
import {useTopOffset} from 'sentry/views/navigation/useTopOffset';

import {useDrawerWidth} from './useDrawerWidth';

export function DrawerHeader(props: DrawerHeaderProps) {
  return <BaseDrawerHeader height={`${PRIMARY_HEADER_HEIGHT}px`} {...props} />;
}

export function DrawerPanel({
  drawerKey,
  ...props
}: DrawerPanelProps & {drawerKey?: string}) {
  const theme = useTheme();
  // The drawer is fixed to the viewport.
  // oxlint-disable-next-line @sentry/scraps/prefer-container-responsive-props
  const isSmallScreen = useMedia(`(max-width: ${theme.breakpoints.sm})`);
  const {contentTop} = useTopOffset();
  const [widthPercent, onWidthChange] = useDrawerWidth({
    drawerKey,
    drawerWidth: props.drawerWidth,
  });
  return (
    <BaseDrawerPanel
      {...props}
      contentTop={contentTop}
      widthPercent={widthPercent}
      onWidthChange={onWidthChange}
      isSmallScreen={isSmallScreen}
      showResizeHandle={!!drawerKey}
    />
  );
}
