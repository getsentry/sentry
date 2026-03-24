import {Fragment, useCallback, useLayoutEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';

export function getDiffNW(yDiff: number, xDiff: number) {
  return (yDiff - yDiff * 2 + (xDiff - xDiff * 2)) / 2;
}

export function getDiffNE(yDiff: number, xDiff: number) {
  return (yDiff - yDiff * 2 + xDiff) / 2;
}

export function getDiffSW(yDiff: number, xDiff: number) {
  return (yDiff + (xDiff - xDiff * 2)) / 2;
}

export function getDiffSE(yDiff: number, xDiff: number) {
  return (yDiff + xDiff) / 2;
}

const RESIZER_POSITIONS = {
  nw: ['top', 'left'],
  ne: ['top', 'right'],
  se: ['bottom', 'right'],
  sw: ['bottom', 'left'],
};

type Position = keyof typeof RESIZER_POSITIONS;

interface Rect {
  left: number;
  size: number;
  top: number;
}

interface Props {
  maxDimension: number;
  minDimension: number;
  updateDataUrlState: (dataUrl: string) => void;
  dataUrl?: string;
}

function makeMaskClipPath({top, left, size}: Rect): string {
  const x1 = left;
  const y1 = top;
  const x2 = left + size;
  const y2 = top + size;

  return `polygon(0 0, 0 100%, 100% 100%, 100% 0, 0 0,
                ${x1}px ${y1}px, ${x2}px ${y1}px,
                ${x2}px ${y2}px, ${x1}px ${y2}px,
                ${x1}px ${y1}px)`;
}

/**
 * Determine the ration between the natural image size and the scaled size
 */
function getScaleRatio(imageRef: React.RefObject<HTMLImageElement | null>) {
  if (!imageRef.current) {
    return 1;
  }

  return (
    (imageRef.current.naturalHeight / imageRef.current.clientHeight +
      imageRef.current.naturalWidth / imageRef.current.clientWidth) /
    2
  );
}

function AvatarCropper({maxDimension, minDimension, updateDataUrlState, dataUrl}: Props) {
  const [offsets, setOffsets] = useState({top: 0, left: 0});
  const [mouseDown, setMouseDown] = useState(false);
  const [mousePosition, setMousePosition] = useState({pageX: 0, pageY: 0});
  const [resizeDimensions, setResizeDimensions] = useState<Rect>({
    top: 0,
    left: 0,
    size: 0,
  });
  const [resizeDirection, setResizeDirection] = useState<Position | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const cropContainerRef = useRef<HTMLDivElement>(null);

  const onImageLoad = () => {
    if (!imageRef.current || !cropContainerRef.current) {
      return;
    }

    const containerRect = cropContainerRef.current.getBoundingClientRect();
    const imageRect = imageRef.current.getBoundingClientRect();
    const top = imageRect.y - containerRect.y;
    const left = imageRect.x - containerRect.x;

    const dimension = Math.min(
      imageRef.current.clientHeight,
      imageRef.current.clientWidth
    );

    const newDimensions = {size: dimension, top: 0, left: 0};
    setResizeDimensions(newDimensions);
    setOffsets({left, top});

    drawToCanvas(newDimensions);
  };

  const drawToCanvas = useCallback(
    (dimensions = resizeDimensions) => {
      if (!canvasRef.current || !imageRef.current) {
        return;
      }

      const {left, top, size} = dimensions;
      // Calculate difference between natural dimensions and rendered dimensions
      const scaleRatio = getScaleRatio(imageRef);

      // Do not let the image scale to a resolution larger than the max
      // dimension
      const drawSize =
        size * scaleRatio > maxDimension ? maxDimension : size * scaleRatio;

      canvasRef.current.width = drawSize;
      canvasRef.current.height = drawSize;

      canvasRef.current
        .getContext('2d')!
        .drawImage(
          imageRef.current,
          left * scaleRatio,
          top * scaleRatio,
          size * scaleRatio,
          size * scaleRatio,
          0,
          0,
          drawSize,
          drawSize
        );

      updateDataUrlState(canvasRef.current.toDataURL());
    },
    [maxDimension, resizeDimensions, updateDataUrlState]
  );

  const startResize = (direction: Position, ev: React.MouseEvent<HTMLDivElement>) => {
    ev.stopPropagation();
    ev.preventDefault();

    setResizeDirection(direction);
    setMousePosition({pageY: ev.pageY, pageX: ev.pageX});
  };

  const getNewDimensions = useCallback(
    (image: HTMLImageElement, yDiff: number, xDiff: number) => {
      const minDimensionNew = minDimension / getScaleRatio(imageRef);

      // Normalize diff across dimensions so that negative diffs are always making
      // the cropper smaller and positive ones are making the cropper larger
      const helpers: Record<string, (yDiff: number, xDiff: number) => number> = {
        getDiffNE,
        getDiffNW,
        getDiffSE,
        getDiffSW,
      } as const;

      const diff = helpers['getDiff' + resizeDirection!.toUpperCase()]!(yDiff, xDiff);

      let height = image.clientHeight - resizeDimensions.top;
      let width = image.clientWidth - resizeDimensions.left;

      // Depending on the direction, we update different dimensions:
      // nw: size, top, left
      // ne: size, top
      // sw: size, left
      // se: size
      const editingTop = resizeDirection === 'nw' || resizeDirection === 'ne';
      const editingLeft = resizeDirection === 'nw' || resizeDirection === 'sw';

      const newDimensions = {
        top: resizeDimensions.top,
        left: resizeDimensions.left,
        size: resizeDimensions.size + diff,
      };

      if (editingTop) {
        newDimensions.top = resizeDimensions.top - diff;
        height = image.clientHeight - newDimensions.top;
      }

      if (editingLeft) {
        newDimensions.left = resizeDimensions.left - diff;
        width = image.clientWidth - newDimensions.left;
      }

      if (newDimensions.top < 0) {
        newDimensions.size = newDimensions.size + newDimensions.top;
        if (editingLeft) {
          newDimensions.left = newDimensions.left - newDimensions.top;
        }
        newDimensions.top = 0;
      }

      if (newDimensions.left < 0) {
        newDimensions.size = newDimensions.size + newDimensions.left;
        if (editingTop) {
          newDimensions.top = newDimensions.top - newDimensions.left;
        }
        newDimensions.left = 0;
      }

      const maxSize = Math.min(width, height);
      if (newDimensions.size > maxSize) {
        if (editingTop) {
          newDimensions.top = newDimensions.top + newDimensions.size - maxSize;
        }
        if (editingLeft) {
          newDimensions.left = newDimensions.left + newDimensions.size - maxSize;
        }
        newDimensions.size = maxSize;
      } else if (newDimensions.size < minDimensionNew) {
        if (editingTop) {
          newDimensions.top = newDimensions.top + newDimensions.size - minDimensionNew;
        }
        if (editingLeft) {
          newDimensions.left = newDimensions.left + newDimensions.size - minDimensionNew;
        }
        newDimensions.size = minDimensionNew;
      }

      return {...resizeDimensions, ...newDimensions};
    },
    [minDimension, resizeDimensions, resizeDirection]
  );

  // Movement event handlers -> effect: active on mouse down on the Cropper

  const onMouseDown = useCallback((ev: React.MouseEvent<HTMLDivElement>) => {
    ev.preventDefault();
    setMouseDown(true);
    setMousePosition({pageY: ev.pageY, pageX: ev.pageX});
  }, []);

  const onMouseUp = useCallback(
    (ev: MouseEvent) => {
      ev.preventDefault();
      setMouseDown(false);
      drawToCanvas();
    },
    [drawToCanvas]
  );

  const updateDimensions = useCallback(
    (ev: MouseEvent) => {
      const image = imageRef.current;
      if (!image) {
        return;
      }

      let pageY = ev.pageY;
      let pageX = ev.pageX;
      let top = resizeDimensions.top + (pageY - mousePosition.pageY);
      let left = resizeDimensions.left + (pageX - mousePosition.pageX);

      if (top < 0) {
        top = 0;
        pageY = mousePosition.pageY;
      } else if (top + resizeDimensions.size > image.clientHeight) {
        top = image.clientHeight - resizeDimensions.size;
        pageY = mousePosition.pageY;
      }

      if (left < 0) {
        left = 0;
        pageX = mousePosition.pageX;
      } else if (left + resizeDimensions.size > image.clientWidth) {
        left = image.clientWidth - resizeDimensions.size;
        pageX = mousePosition.pageX;
      }

      setResizeDimensions({...resizeDimensions, top, left});
      setMousePosition({pageX, pageY});
    },
    [mousePosition.pageX, mousePosition.pageY, resizeDimensions]
  );

  useLayoutEffect(() => {
    if (mouseDown) {
      document.addEventListener('mousemove', updateDimensions);
      document.addEventListener('mouseup', onMouseUp);
    } else {
      document.removeEventListener('mousemove', updateDimensions);
      document.removeEventListener('mouseup', onMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', updateDimensions);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [mouseDown, onMouseUp, updateDimensions]);

  // Resizing event handlers -> effect: active when there is a resize direction

  const stopResize = useCallback(
    (ev: MouseEvent) => {
      ev.stopPropagation();
      ev.preventDefault();

      setResizeDirection(null);
      drawToCanvas();
    },
    [drawToCanvas]
  );

  const updateSize = useCallback(
    (ev: MouseEvent) => {
      if (!imageRef.current) {
        return;
      }

      const yDiff = ev.pageY - mousePosition.pageY;
      const xDiff = ev.pageX - mousePosition.pageX;

      setResizeDimensions(getNewDimensions(imageRef.current, yDiff, xDiff));
      setMousePosition({pageX: ev.pageX, pageY: ev.pageY});
    },
    [getNewDimensions, mousePosition.pageX, mousePosition.pageY]
  );

  useLayoutEffect(() => {
    if (!resizeDirection) {
      return;
    }

    document.addEventListener('mousemove', updateSize);
    document.addEventListener('mouseup', stopResize);

    // eslint-disable-next-line consistent-return
    return () => {
      document.removeEventListener('mousemove', updateSize);
      document.removeEventListener('mouseup', stopResize);
    };
  }, [resizeDirection, stopResize, updateSize]);

  function renderImageCrop() {
    if (!dataUrl) {
      return null;
    }

    const style = {
      top: resizeDimensions.top + offsets.top,
      left: resizeDimensions.left + offsets.left,
      width: resizeDimensions.size,
      height: resizeDimensions.size,
    };

    const maskClipPath = makeMaskClipPath({
      top: style.top,
      left: style.left,
      size: resizeDimensions.size,
    });

    return (
      <ImageCropper ref={cropContainerRef} resizeDirection={resizeDirection}>
        <Image
          ref={imageRef}
          src={dataUrl}
          crossOrigin="anonymous"
          onLoad={onImageLoad}
          onDragStart={e => e.preventDefault()}
        />
        <Mask style={{clipPath: maskClipPath}} />
        <Cropper style={style} onMouseDown={onMouseDown}>
          {Object.keys(RESIZER_POSITIONS).map(pos => (
            <ResizeHandle
              key={pos}
              position={pos as Position}
              onMouseDown={e => startResize(pos as Position, e)}
            />
          ))}
        </Cropper>
      </ImageCropper>
    );
  }

  return (
    <Fragment>
      {dataUrl && <HiddenCanvas ref={canvasRef} className="sentry-block" />}
      {renderImageCrop()}
    </Fragment>
  );
}

export {AvatarCropper};

const ImageCropper = styled('div')<{resizeDirection: Position | null}>`
  position: relative;
  width: 100%;
  height: 100%;
  aspect-ratio: 1 / 1;
  display: flex;
  align-items: center;
  justify-content: center;

  background-size: 20px 20px;
  background-position:
    0 0,
    0 10px,
    10px -10px,
    -10px 0px;
  background-color: ${p => p.theme.tokens.background.primary};
  background-image:
    linear-gradient(
      45deg,
      ${p => p.theme.tokens.background.secondary} 25%,
      rgba(0, 0, 0, 0) 25%
    ),
    linear-gradient(
      -45deg,
      ${p => p.theme.tokens.background.secondary} 25%,
      rgba(0, 0, 0, 0) 25%
    ),
    linear-gradient(
      45deg,
      rgba(0, 0, 0, 0) 75%,
      ${p => p.theme.tokens.background.secondary} 75%
    ),
    linear-gradient(
      -45deg,
      rgba(0, 0, 0, 0) 75%,
      ${p => p.theme.tokens.background.secondary} 75%
    );

  cursor: ${p => (p.resizeDirection ? `${p.resizeDirection}-resize` : 'default')};
`;

const Image = styled('img')`
  max-width: 100%;
  max-height: 100%;
`;

const Mask = styled('div')`
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.25);
  pointer-events: none;
  border-radius: ${p => p.theme.radius.md};
`;

const Cropper = styled('div')`
  position: absolute;
  border: 1px dashed ${p => p.theme.colors.gray400};
  display: grid;

  /* Cropper cross-hair */
  &::before,
  &:after {
    content: '';
    grid-row: 1;
    grid-column: 1;
    height: inherit;
    width: inherit;
    background: rgba(255, 255, 255, 0.1);
  }
  &::before {
    height: 1px;
    align-self: center;
  }
  &::after {
    width: 1px;
    justify-self: center;
  }
`;

const ResizeHandle = styled('div')<{position: Position}>`
  border-radius: 2px;
  width: 10px;
  height: 10px;
  position: absolute;
  background-color: ${p => p.theme.colors.gray400};
  cursor: ${p => `${p.position}-resize`};
  ${p => RESIZER_POSITIONS[p.position].map(pos => `${pos}: -5px;`)}
`;

const HiddenCanvas = styled('canvas')`
  display: none;
`;
