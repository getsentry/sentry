import type {DrawerOptions, DrawerRenderProps} from 'sentry/components/globalDrawer';
import DrawerStore from 'sentry/stores/drawerStore';

export function openDrawer(
  renderer: (renderProps: DrawerRenderProps) => React.ReactNode,
  options?: DrawerOptions
) {
  DrawerStore.openDrawer(renderer, options ?? {});
}

export function closeDrawer() {
  DrawerStore.closeDrawer();
}
