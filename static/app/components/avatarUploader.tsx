import {Component, createRef, Fragment} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/button';
import Well from 'sentry/components/well';
import {AVATAR_URL_MAP} from 'sentry/constants';
import {t, tct} from 'sentry/locale';
import type {AvatarUser} from 'sentry/types/user';

const ALLOWED_MIMETYPES = 'image/gif,image/jpeg,image/png';

// These values must be synced with the avatar endpoint in backend.
const MIN_DIMENSION = 256;
const MAX_DIMENSION = 1024;

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

const resizerPositions = {
  nw: ['top', 'left'],
  ne: ['top', 'right'],
  se: ['bottom', 'right'],
  sw: ['bottom', 'left'],
};

type Position = keyof typeof resizerPositions;

type Model = Pick<AvatarUser, 'avatar'>;

type Props = {
  model: Model;
  type:
    | 'user'
    | 'team'
    | 'organization'
    | 'project'
    | 'sentryAppColor'
    | 'sentryAppSimple'
    | 'docIntegration';
  updateDataUrlState: (opts: {dataUrl?: string; savedDataUrl?: string | null}) => void;
  uploadDomain: string;
  savedDataUrl?: string;
};

type State = {
  file: File | null;
  mousePosition: {pageX: number; pageY: number};
  objectURL: string | null;
  resizeDimensions: {left: number; size: number; top: number};
  resizeDirection: Position | null;
};

class AvatarUploader extends Component<Props, State> {
  state: State = {
    file: null,
    objectURL: null,
    mousePosition: {pageX: 0, pageY: 0},
    resizeDimensions: {top: 0, left: 0, size: 0},
    resizeDirection: null,
  };

  componentWillUnmount() {
    this.revokeObjectUrl();
  }

  file = createRef<HTMLInputElement>();
  canvas = createRef<HTMLCanvasElement>();
  image = createRef<HTMLImageElement>();
  cropContainer = createRef<HTMLDivElement>();

  onSelectFile = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];

    // No file selected (e.g. user clicked "cancel")
    if (!file) {
      return;
    }

    if (!/^image\//.test(file.type)) {
      addErrorMessage(t('That is not a supported file type.'));
      return;
    }

    this.revokeObjectUrl();

    const {updateDataUrlState} = this.props;
    const objectURL = window.URL.createObjectURL(file);
    this.setState({file, objectURL}, () => updateDataUrlState({savedDataUrl: null}));
  };

  revokeObjectUrl = () =>
    this.state.objectURL && window.URL.revokeObjectURL(this.state.objectURL);

  onImageLoad = () => {
    const error = this.validateImage();
    if (error) {
      this.revokeObjectUrl();
      this.setState({objectURL: null});
      addErrorMessage(error);
      return;
    }

    const image = this.image.current;
    if (!image) {
      return;
    }

    const dimension = Math.min(image.clientHeight, image.clientWidth);
    const state = {resizeDimensions: {size: dimension, top: 0, left: 0}};

    this.setState(state, this.drawToCanvas);
  };

  updateDimensions = (ev: MouseEvent) => {
    const cropContainer = this.cropContainer.current;
    if (!cropContainer) {
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
    } else if (top + resizeDimensions.size > cropContainer.clientHeight) {
      top = cropContainer.clientHeight - resizeDimensions.size;
      pageY = mousePosition.pageY;
    }

    if (left < 0) {
      left = 0;
      pageX = mousePosition.pageX;
    } else if (left + resizeDimensions.size > cropContainer.clientWidth) {
      left = cropContainer.clientWidth - resizeDimensions.size;
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
    const cropContainer = this.cropContainer.current;
    if (!cropContainer) {
      return;
    }

    const {mousePosition} = this.state;

    const yDiff = ev.pageY - mousePosition.pageY;
    const xDiff = ev.pageX - mousePosition.pageX;

    this.setState({
      resizeDimensions: this.getNewDimensions(cropContainer, yDiff, xDiff),
      mousePosition: {pageX: ev.pageX, pageY: ev.pageY},
    });
  };

  getNewDimensions = (container: HTMLDivElement, yDiff: number, xDiff: number) => {
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

    let height = container.clientHeight - oldDimensions.top;
    let width = container.clientWidth - oldDimensions.left;

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
      height = container.clientHeight - newDimensions.top;
    }

    if (editingLeft) {
      newDimensions.left = oldDimensions.left - diff;
      width = container.clientWidth - newDimensions.left;
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
    } else if (newDimensions.size < MIN_DIMENSION) {
      if (editingTop) {
        newDimensions.top = newDimensions.top + newDimensions.size - MIN_DIMENSION;
      }
      if (editingLeft) {
        newDimensions.left = newDimensions.left + newDimensions.size - MIN_DIMENSION;
      }
      newDimensions.size = MIN_DIMENSION;
    }

    return {...oldDimensions, ...newDimensions};
  };

  validateImage() {
    const img = this.image.current;

    if (!img) {
      return null;
    }

    if (img.naturalWidth < MIN_DIMENSION || img.naturalHeight < MIN_DIMENSION) {
      return tct('Please upload an image larger than [size]px by [size]px.', {
        size: MIN_DIMENSION - 1,
      });
    }

    if (img.naturalWidth > MAX_DIMENSION || img.naturalHeight > MAX_DIMENSION) {
      return tct('Please upload an image smaller than [size]px by [size]px.', {
        size: MAX_DIMENSION,
      });
    }

    return null;
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
    const ratio =
      (image.naturalHeight / image.clientHeight +
        image.naturalWidth / image.clientWidth) /
      2;
    canvas.width = size * ratio;
    canvas.height = size * ratio;

    canvas
      .getContext('2d')!
      .drawImage(
        image,
        left * ratio,
        top * ratio,
        size * ratio,
        size * ratio,
        0,
        0,
        size * ratio,
        size * ratio
      );

    this.props.updateDataUrlState({dataUrl: canvas.toDataURL()});
  }

  get imageSrc() {
    const {savedDataUrl, model, type, uploadDomain} = this.props;
    const uuid = model.avatar?.avatarUuid;
    const photoUrl =
      uuid && `${uploadDomain}/${AVATAR_URL_MAP[type] || 'avatar'}/${uuid}/`;

    return savedDataUrl || this.state.objectURL || photoUrl;
  }

  uploadClick = (ev: React.MouseEvent<HTMLAnchorElement>) => {
    ev.preventDefault();
    this.file.current?.click();
  };

  renderImageCrop() {
    const src = this.imageSrc;
    if (!src) {
      return null;
    }

    const {resizeDimensions, resizeDirection} = this.state;
    const style = {
      top: resizeDimensions.top,
      left: resizeDimensions.left,
      width: resizeDimensions.size,
      height: resizeDimensions.size,
    };

    return (
      <ImageCropper resizeDirection={resizeDirection}>
        <CropContainer ref={this.cropContainer}>
          <img
            ref={this.image}
            src={src}
            crossOrigin="anonymous"
            onLoad={this.onImageLoad}
            onDragStart={e => e.preventDefault()}
          />
          <Cropper style={style} onMouseDown={this.onMouseDown}>
            {Object.keys(resizerPositions).map(pos => (
              <Resizer
                key={pos}
                position={pos as Position}
                onMouseDown={this.startResize.bind(this, pos)}
              />
            ))}
          </Cropper>
        </CropContainer>
      </ImageCropper>
    );
  }

  render() {
    const src = this.imageSrc;

    const upload = <a onClick={this.uploadClick} />;
    const uploader = (
      <Well hasImage centered>
        <p>{tct('[upload:Upload an image] to get started.', {upload})}</p>
      </Well>
    );

    return (
      <Fragment>
        {!src && uploader}
        {src && <HiddenCanvas ref={this.canvas} />}
        {this.renderImageCrop()}
        <div className="form-group">
          {src && (
            <Button priority="link" onClick={this.uploadClick}>
              {t('Change Photo')}
            </Button>
          )}
          <UploadInput
            ref={this.file}
            type="file"
            accept={ALLOWED_MIMETYPES}
            onChange={this.onSelectFile}
          />
        </div>
      </Fragment>
    );
  }
}

export {AvatarUploader};

const UploadInput = styled('input')`
  position: absolute;
  opacity: 0;
`;

const ImageCropper = styled('div')<{resizeDirection: Position | null}>`
  cursor: ${p => (p.resizeDirection ? `${p.resizeDirection}-resize` : 'default')};
  text-align: center;
  margin-bottom: 20px;
  background-size: 20px 20px;
  background-position:
    0 0,
    0 10px,
    10px -10px,
    -10px 0px;
  background-color: ${p => p.theme.background};
  background-image: linear-gradient(
      45deg,
      ${p => p.theme.backgroundSecondary} 25%,
      rgba(0, 0, 0, 0) 25%
    ),
    linear-gradient(-45deg, ${p => p.theme.backgroundSecondary} 25%, rgba(0, 0, 0, 0) 25%),
    linear-gradient(45deg, rgba(0, 0, 0, 0) 75%, ${p => p.theme.backgroundSecondary} 75%),
    linear-gradient(-45deg, rgba(0, 0, 0, 0) 75%, ${p => p.theme.backgroundSecondary} 75%);
`;

const CropContainer = styled('div')`
  display: inline-block;
  position: relative;
  max-width: 100%;
`;

const Cropper = styled('div')`
  position: absolute;
  border: 2px dashed ${p => p.theme.gray300};
`;

const Resizer = styled('div')<{position: Position}>`
  border-radius: 5px;
  width: 10px;
  height: 10px;
  position: absolute;
  background-color: ${p => p.theme.gray300};
  cursor: ${p => `${p.position}-resize`};
  ${p => resizerPositions[p.position].map(pos => `${pos}: -5px;`)}
`;

const HiddenCanvas = styled('canvas')`
  display: none;
`;
