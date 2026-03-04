import {Flex} from '@sentry/scraps/layout';

import {useD3Zoom} from './useD3Zoom';
import {
  ZoomableArea,
  ZoomableImage,
  ZoomContainer,
  ZoomContent,
  ZoomControls,
  zoomTransformStyle,
} from './zoomControls';

interface SingleImageDisplayProps {
  alt: string;
  imageUrl: string;
}

export function SingleImageDisplay({imageUrl, alt}: SingleImageDisplayProps) {
  const {containerRef, transform, zoomIn, zoomOut, resetZoom} = useD3Zoom();

  return (
    <Flex align="center" justify="center" height="100%" padding="3xl">
      <ZoomableArea>
        <ZoomContainer ref={containerRef}>
          <ZoomContent style={zoomTransformStyle(transform)}>
            <ZoomableImage src={imageUrl} alt={alt} />
          </ZoomContent>
        </ZoomContainer>
        <ZoomControls onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={resetZoom} />
      </ZoomableArea>
    </Flex>
  );
}
