import {
  fixedContainerBottomRightCornderCss,
  fixedContainerRightEdgeCss,
} from '../styles/fixedContainer';
import {
  navigationBottomRightCornerCss,
  navigationRightEdgeCss,
} from '../styles/navigation';

import useConfiguration from './useConfiguration';

export default function usePlacementCss() {
  const {placement} = useConfiguration();

  switch (placement) {
    case 'right-edge':
      return {
        fixedContainer: {
          css: fixedContainerRightEdgeCss,
        },
        navigation: {
          css: navigationRightEdgeCss,
        },
      };
    case 'bottom-right-corner':
    default:
      return {
        fixedContainer: {
          css: fixedContainerBottomRightCornderCss,
        },
        navigation: {
          css: navigationBottomRightCornerCss,
        },
      };
  }
}
