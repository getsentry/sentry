import {platform} from '@floating-ui/react-dom';

import {overlayPlatform} from '@sentry/scraps/overlayPositioning';

/**
 * Builds a positioned `display: contents` wrapper around an absolutely
 * positioned overlay, with an `overflow: hidden` element either inside or
 * outside the overlay's real containing block.
 */
function renderOverlay({
  clipperOutsideContainingBlock,
}: {
  clipperOutsideContainingBlock: boolean;
}) {
  const containingBlock = document.createElement('div');
  containingBlock.style.position = 'relative';
  const clipper = document.createElement('div');
  clipper.style.overflow = 'hidden';
  const contentsWrap = document.createElement('div');
  contentsWrap.style.display = 'contents';
  contentsWrap.style.position = 'relative';
  const overlay = document.createElement('div');
  overlay.style.position = 'absolute';

  if (clipperOutsideContainingBlock) {
    clipper.append(containingBlock);
    containingBlock.append(contentsWrap);
    document.body.append(clipper);
  } else {
    containingBlock.append(clipper);
    clipper.append(contentsWrap);
    document.body.append(containingBlock);
  }
  contentsWrap.append(overlay);

  // jsdom has no layout, so mock the offset parent the browser resolves
  jest.spyOn(overlay, 'offsetParent', 'get').mockReturnValue(containingBlock);

  return {clipper, overlay};
}

function getClippingAncestors(overlay: HTMLElement) {
  const getClippingRect = jest.spyOn(platform, 'getClippingRect');
  overlayPlatform.getClippingRect({
    element: overlay,
    boundary: 'clippingAncestors',
    rootBoundary: 'viewport',
    strategy: 'absolute',
  });
  return getClippingRect.mock.lastCall?.[0].boundary;
}

describe('overlayPlatform', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    jest.restoreAllMocks();
  });

  it('ignores overflow ancestors inside the containing block', () => {
    const {overlay} = renderOverlay({clipperOutsideContainingBlock: false});

    expect(getClippingAncestors(overlay)).toEqual([]);
  });

  it('keeps overflow ancestors that contain the containing block', () => {
    const {clipper, overlay} = renderOverlay({clipperOutsideContainingBlock: true});

    expect(getClippingAncestors(overlay)).toEqual([clipper]);
  });
});
