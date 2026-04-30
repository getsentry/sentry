import {Flex} from '@sentry/scraps/layout';

import {useBufferedImageUrl} from './useBufferedImageUrl';
import {useD3Zoom} from './useD3Zoom';
import {
  ZoomableArea,
  ZoomableImage,
  ZoomContainer,
  ZoomControls,
  zoomTransformStyle,
} from './zoomControls';

interface SingleImageDisplayProps {
  alt: string;
  imageUrl: string;
}

export function SingleImageDisplay({imageUrl, alt}: SingleImageDisplayProps) {
  const {containerRef, transform, zoomIn, zoomOut, resetZoom} = useD3Zoom();
  const displayUrl = useBufferedImageUrl(imageUrl);

  return (
    <Flex align="center" justify="center" flex="1" minHeight="0" padding="3xl">
      <ZoomableArea>
        <ZoomContainer ref={containerRef}>
          <Flex
            justify="center"
            align="center"
            width="100%"
            height="100%"
            style={zoomTransformStyle(transform)}
          >
            <ZoomableImage src={displayUrl} alt={alt} loading="eager" decoding="async" />
          </Flex>
        </ZoomContainer>
        <ZoomControls onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={resetZoom} />
      </ZoomableArea>
    </Flex>
  );
}
