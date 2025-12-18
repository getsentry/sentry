import {Component, createRef, Fragment} from 'react';
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

class AvatarCropper extends Component<Props, State> {
  state: State = {
    objectURL: null,
    offsets: {top: 0, left: 0},
    mousePosition: {pageX: 0, pageY: 0},
    resizeDimensions: {top: 0, left: 0, size: 0},
    resizeDirection: null,
  };

  canvas = createRef<HTMLCanvasElement>();
  image = createRef<HTMLImageElement>();
  cropContainer = createRef<HTMLDivElement>();

  onImageLoad = () => {
    const container = this.cropContainer.current;
    const image = this.image.current;
    if (!image || !container) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const imageRect = image.getBoundingClientRect();
    const top = imageRect.y - containerRect.y;
    const left = imageRect.x - containerRect.x;

    const dimension = Math.min(image.clientHeight, image.clientWidth);
    const state = {
      resizeDimensions: {size: dimension, top: 0, left: 0},
      offsets: {left, top},
    };

    this.setState(state, this.drawToCanvas);
  };

  updateDimensions = (ev: MouseEvent) => {
    const image = this.image.current;
    if (!image) {
      return;
    }

    const {mousePosition, resizeDimensions} = this.state;

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

    this.setState(state => ({
      resizeDimensions: {...state.resizeDimensions, top, left},
      mousePosition: {pageX, pageY},
    }));
  };

  onMouseDown = (ev: React.MouseEvent<HTMLDivElement>) => {
    ev.preventDefault();
    this.setState({mousePosition: {pageY: ev.pageY, pageX: ev.pageX}});

    document.addEventListener('mousemove', this.updateDimensions);
    document.addEventListener('mouseup', this.onMouseUp);
  };

  onMouseUp = (ev: MouseEvent) => {
    ev.preventDefault();
    document.removeEventListener('mousemove', this.updateDimensions);
    document.removeEventListener('mouseup', this.onMouseUp);
    this.drawToCanvas();
  };

  startResize = (direction: Position, ev: React.MouseEvent<HTMLDivElement>) => {
    ev.stopPropagation();
    ev.preventDefault();
    document.addEventListener('mousemove', this.updateSize);
    document.addEventListener('mouseup', this.stopResize);

    this.setState({
      resizeDirection: direction,
      mousePosition: {pageY: ev.pageY, pageX: ev.pageX},
    });
  };

  stopResize = (ev: MouseEvent) => {
    ev.stopPropagation();
    ev.preventDefault();
    document.removeEventListener('mousemove', this.updateSize);
    document.removeEventListener('mouseup', this.stopResize);

    this.setState({resizeDirection: null});
    this.drawToCanvas();
  };

  updateSize = (ev: MouseEvent) => {
    const image = this.image.current;
    if (!image) {
      return;
    }

    const {mousePosition} = this.state;

    const yDiff = ev.pageY - mousePosition.pageY;
    const xDiff = ev.pageX - mousePosition.pageX;

    this.setState({
      resizeDimensions: this.getNewDimensions(image, yDiff, xDiff),
      mousePosition: {pageX: ev.pageX, pageY: ev.pageY},
    });
  };

  getNewDimensions = (image: HTMLImageElement, yDiff: number, xDiff: number) => {
    const minDimension = this.props.minDimension / this.scaleRatio;
    const {resizeDimensions: oldDimensions, resizeDirection} = this.state;

    // Normalize diff across dimensions so that negative diffs are always making
    // the cropper smaller and positive ones are making the cropper larger
    const helpers: Record<string, (yDiff: number, xDiff: number) => number> = {
      getDiffNE,
      getDiffNW,
      getDiffSE,
      getDiffSW,
    } as const;

    const diff = helpers['getDiff' + resizeDirection!.toUpperCase()]!(yDiff, xDiff);

    let height = image.clientHeight - oldDimensions.top;
    let width = image.clientWidth - oldDimensions.left;

    // Depending on the direction, we update different dimensions:
    // nw: size, top, left
    // ne: size, top
    // sw: size, left
    // se: size
    const editingTop = resizeDirection === 'nw' || resizeDirection === 'ne';
    const editingLeft = resizeDirection === 'nw' || resizeDirection === 'sw';

    const newDimensions = {
      top: oldDimensions.top,
      left: oldDimensions.left,
      size: oldDimensions.size + diff,
    };

    if (editingTop) {
      newDimensions.top = oldDimensions.top - diff;
      height = image.clientHeight - newDimensions.top;
    }

    if (editingLeft) {
      newDimensions.left = oldDimensions.left - diff;
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
    } else if (newDimensions.size < minDimension) {
      if (editingTop) {
        newDimensions.top = newDimensions.top + newDimensions.size - minDimension;
      }
      if (editingLeft) {
        newDimensions.left = newDimensions.left + newDimensions.size - minDimension;
      }
      newDimensions.size = minDimension;
    }

    return {...oldDimensions, ...newDimensions};
  };

  /**
   * Determine the ration between the natural image size and the scaled size
   */
  get scaleRatio() {
    const image = this.image.current;
    if (!image) {
      return 1;
    }

    return (
      (image.naturalHeight / image.clientHeight +
        image.naturalWidth / image.clientWidth) /
      2
    );
  }

  drawToCanvas() {
    const canvas = this.canvas.current;
    if (!canvas) {
      return;
    }

    const image = this.image.current;
    if (!image) {
      return;
    }

    const {left, top, size} = this.state.resizeDimensions;
    // Calculate difference between natural dimensions and rendered dimensions
    const scaleRatio = this.scaleRatio;

    // Do not let the image scale to a resolution larger than the max
    // dimension
    const {maxDimension} = this.props;
    const drawSize = size * scaleRatio > maxDimension ? maxDimension : size * scaleRatio;

    canvas.width = drawSize;
    canvas.height = drawSize;

    canvas
      .getContext('2d')!
      .drawImage(
        image,
        left * scaleRatio,
        top * scaleRatio,
        size * scaleRatio,
        size * scaleRatio,
        0,
        0,
        drawSize,
        drawSize
      );

    this.props.updateDataUrlState(canvas.toDataURL());
  }

  get imageSrc() {
    return this.props.dataUrl;
  }

  renderImageCrop() {
    const src = this.imageSrc;
    if (!src) {
      return null;
    }

    const {resizeDimensions, resizeDirection, offsets} = this.state;
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
      <ImageCropper ref={this.cropContainer} resizeDirection={resizeDirection}>
        <Image
          ref={this.image}
          src={src}
          crossOrigin="anonymous"
          onLoad={this.onImageLoad}
          onDragStart={e => e.preventDefault()}
        />
        <Mask style={{clipPath: maskClipPath}} />
        <Cropper style={style} onMouseDown={this.onMouseDown}>
          {Object.keys(RESIZER_POSITIONS).map(pos => (
            <ResizeHandle
              key={pos}
              position={pos as Position}
              onMouseDown={this.startResize.bind(this, pos)}
            />
          ))}
        </Cropper>
      </ImageCropper>
    );
  }

  render() {
    const src = this.imageSrc;

    return (
      <Fragment>
        {src && <HiddenCanvas ref={this.canvas} className="sentry-block" />}
        {this.renderImageCrop()}
      </Fragment>
    );
  }
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
