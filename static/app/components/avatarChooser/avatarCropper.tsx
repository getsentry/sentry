import {Fragment, useRef, useState} from 'react';
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
} as const;

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

interface State {
  mousePosition: {pageX: number; pageY: number};
  objectURL: string | null;
  offsets: {left: number; top: number};
  resizeDimensions: Rect;
  resizeDirection: Position | null;
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

function AvatarCropper(props: Props) {
  const [state, setState] = useState<State>({
    objectURL: null,
    offsets: {top: 0, left: 0},
    mousePosition: {pageX: 0, pageY: 0},
    resizeDimensions: {top: 0, left: 0, size: 0},
    resizeDirection: null,
  });

  const canvas = useRef<HTMLCanvasElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const cropContainer = useRef<HTMLDivElement>(null);

  function getScaleRatio() {
    const img = image.current;
    if (!img) {
      return 1;
    }
    return (
      (img.naturalHeight / img.clientHeight + img.naturalWidth / img.clientWidth) / 2
    );
  }

  function drawToCanvas(dimensions?: Rect) {
    const cnv = canvas.current;
    if (!cnv) {
      return;
    }

    const img = image.current;
    if (!img) {
      return;
    }

    const {left, top, size} = dimensions ?? state.resizeDimensions;
    const scaleRatio = getScaleRatio();
    const {maxDimension} = props;
    const drawSize = size * scaleRatio > maxDimension ? maxDimension : size * scaleRatio;

    cnv.width = drawSize;
    cnv.height = drawSize;

    cnv
      .getContext('2d')!
      .drawImage(
        img,
        left * scaleRatio,
        top * scaleRatio,
        size * scaleRatio,
        size * scaleRatio,
        0,
        0,
        drawSize,
        drawSize
      );

    props.updateDataUrlState(cnv.toDataURL());
  }

  const onImageLoad = () => {
    const container = cropContainer.current;
    const img = image.current;
    if (!img || !container) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const imageRect = img.getBoundingClientRect();
    const top = imageRect.y - containerRect.y;
    const left = imageRect.x - containerRect.x;

    const dimension = Math.min(img.clientHeight, img.clientWidth);
    const next = {
      resizeDimensions: {size: dimension, top: 0, left: 0},
      offsets: {left, top},
    };

    setState(prev => ({...prev, ...next}));
    drawToCanvas(next.resizeDimensions);
  };

  const updateDimensions = (ev: MouseEvent) => {
    const img = image.current;
    if (!img) {
      return;
    }

    setState(prev => {
      const {mousePosition, resizeDimensions} = prev;

      let pageY = ev.pageY;
      let pageX = ev.pageX;
      let top = resizeDimensions.top + (pageY - mousePosition.pageY);
      let left = resizeDimensions.left + (pageX - mousePosition.pageX);

      if (top < 0) {
        top = 0;
        pageY = mousePosition.pageY;
      } else if (top + resizeDimensions.size > img.clientHeight) {
        top = img.clientHeight - resizeDimensions.size;
        pageY = mousePosition.pageY;
      }

      if (left < 0) {
        left = 0;
        pageX = mousePosition.pageX;
      } else if (left + resizeDimensions.size > img.clientWidth) {
        left = img.clientWidth - resizeDimensions.size;
        pageX = mousePosition.pageX;
      }

      return {
        ...prev,
        resizeDimensions: {...prev.resizeDimensions, top, left},
        mousePosition: {pageX, pageY},
      };
    });
  };

  const onMouseDown = (ev: React.MouseEvent<HTMLDivElement>) => {
    ev.preventDefault();
    setState(prev => ({...prev, mousePosition: {pageY: ev.pageY, pageX: ev.pageX}}));

    document.addEventListener('mousemove', updateDimensions);
    document.addEventListener('mouseup', onMouseUp as any);
  };

  const onMouseUp = (ev: MouseEvent) => {
    ev.preventDefault();
    document.removeEventListener('mousemove', updateDimensions);
    document.removeEventListener('mouseup', onMouseUp as any);
    drawToCanvas();
  };

  const startResize = (direction: Position, ev: React.MouseEvent<HTMLDivElement>) => {
    ev.stopPropagation();
    ev.preventDefault();
    document.addEventListener('mousemove', updateSize);
    document.addEventListener('mouseup', stopResize as any);

    setState(prev => ({
      ...prev,
      resizeDirection: direction,
      mousePosition: {pageY: ev.pageY, pageX: ev.pageX},
    }));
  };

  const stopResize = (ev: MouseEvent) => {
    ev.stopPropagation();
    ev.preventDefault();
    document.removeEventListener('mousemove', updateSize);
    document.removeEventListener('mouseup', stopResize as any);

    setState(prev => ({...prev, resizeDirection: null}));
    drawToCanvas();
  };

  const updateSize = (ev: MouseEvent) => {
    const img = image.current;
    if (!img) {
      return;
    }

    setState(prev => {
      const yDiff = ev.pageY - prev.mousePosition.pageY;
      const xDiff = ev.pageX - prev.mousePosition.pageX;

      // Normalize diff across dimensions so that negative diffs are always making
      // the cropper smaller and positive ones are making the cropper larger
      const helpers: Record<string, (yDiff: number, xDiff: number) => number> = {
        getDiffNE,
        getDiffNW,
        getDiffSE,
        getDiffSW,
      } as const;

      const diff = helpers['getDiff' + prev.resizeDirection!.toUpperCase()]!(
        yDiff,
        xDiff
      );

      let height = img.clientHeight - prev.resizeDimensions.top;
      let width = img.clientWidth - prev.resizeDimensions.left;

      const editingTop = prev.resizeDirection === 'nw' || prev.resizeDirection === 'ne';
      const editingLeft = prev.resizeDirection === 'nw' || prev.resizeDirection === 'sw';

      const newDimensions = {
        top: prev.resizeDimensions.top,
        left: prev.resizeDimensions.left,
        size: prev.resizeDimensions.size + diff,
      };

      if (editingTop) {
        newDimensions.top = prev.resizeDimensions.top - diff;
        height = img.clientHeight - newDimensions.top;
      }

      if (editingLeft) {
        newDimensions.left = prev.resizeDimensions.left - diff;
        width = img.clientWidth - newDimensions.left;
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
      const minDimension = props.minDimension / getScaleRatio();
      if (newDimensions.size > maxSize) {
        if (editingTop) {
          newDimensions.top = newDimensions.top + newDimensions.size - maxSize;
        }
        if (editingLeft) {
          newDimensions.left = newDimensions.left + newDimensions.size - maxSize;
        }
        newDimensions.size = maxSize;
      } else if (newDimensions.size < minDimension) {
        if (editingTop) {
          newDimensions.top = newDimensions.top + newDimensions.size - minDimension;
        }
        if (editingLeft) {
          newDimensions.left = newDimensions.left + newDimensions.size - minDimension;
        }
        newDimensions.size = minDimension;
      }

      return {
        ...prev,
        resizeDimensions: {...prev.resizeDimensions, ...newDimensions},
        mousePosition: {pageX: ev.pageX, pageY: ev.pageY},
      };
    });
  };

  const imageSrc = props.dataUrl;

  const renderImageCrop = () => {
    const src = imageSrc;
    if (!src) {
      return null;
    }

    const {resizeDimensions, resizeDirection, offsets} = state;
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
      <ImageCropper ref={cropContainer} resizeDirection={resizeDirection}>
        <Image
          ref={image}
          src={src}
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
              onMouseDown={ev => startResize(pos as Position, ev)}
            />
          ))}
        </Cropper>
      </ImageCropper>
    );
  };

  const src = imageSrc;

  return (
    <Fragment>
      {src && <HiddenCanvas ref={canvas} className="sentry-block" />}
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
  background-color: ${p => p.theme.background};
  background-image:
    linear-gradient(45deg, ${p => p.theme.backgroundSecondary} 25%, rgba(0, 0, 0, 0) 25%),
    linear-gradient(
      -45deg,
      ${p => p.theme.backgroundSecondary} 25%,
      rgba(0, 0, 0, 0) 25%
    ),
    linear-gradient(45deg, rgba(0, 0, 0, 0) 75%, ${p => p.theme.backgroundSecondary} 75%),
    linear-gradient(-45deg, rgba(0, 0, 0, 0) 75%, ${p => p.theme.backgroundSecondary} 75%);

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
  border-radius: ${p => p.theme.borderRadius};
`;

const Cropper = styled('div')`
  position: absolute;
  border: 1px dashed ${p => p.theme.gray300};
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
  background-color: ${p => p.theme.gray300};
  cursor: ${p => `${p.position}-resize`};
  ${p => RESIZER_POSITIONS[p.position].map(pos => `${pos}: -5px;`)}
`;

const HiddenCanvas = styled('canvas')`
  display: none;
`;
