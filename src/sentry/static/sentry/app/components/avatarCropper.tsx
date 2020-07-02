import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {AVATAR_URL_MAP} from 'app/constants';
import {t, tct} from 'app/locale';
import Well from 'app/components/well';
import {AvatarUser} from 'app/types';

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
  updateDataUrlState: (opts: {savedDataUrl?: string | null; dataUrl?: string}) => void;
  type: 'user' | 'team' | 'organization' | 'project';
  savedDataUrl?: string;
};

type State = {
  file: File | null;
  objectURL: string | null;
  mousePosition: {pageX: number; pageY: number};
  resizeDimensions: {top: number; left: number; size: number};
  resizeDirection: Position | null;
};

class AvatarCropper extends React.Component<Props, State> {
  static propTypes = {
    model: PropTypes.object.isRequired,
    updateDataUrlState: PropTypes.func.isRequired,
    type: PropTypes.oneOf(['user', 'team', 'organization', 'project']),
    savedDataUrl: PropTypes.string,
  };

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

  file = React.createRef<HTMLInputElement>();
  canvas = React.createRef<HTMLCanvasElement>();
  image = React.createRef<HTMLImageElement>();
  cropContainer = React.createRef<HTMLDivElement>();

  // These values must be synced with the avatar endpoint in backend.
  MIN_DIMENSION = 256;
  MAX_DIMENSION = 1024;
  ALLOWED_MIMETYPES = 'image/gif,image/jpeg,image/png';

  onSelectFile = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files && ev.target.files[0];

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

  // Normalize diff across dimensions so that negative diffs are always making
  // the cropper smaller and positive ones are making the cropper larger
  getDiffNW = (yDiff: number, xDiff: number) =>
    (yDiff - yDiff * 2 + (xDiff - xDiff * 2)) / 2;

  getDiffNE = (yDiff: number, xDiff: number) => (yDiff - yDiff * 2 + xDiff) / 2;

  getDiffSW = (yDiff: number, xDiff: number) => (yDiff + (xDiff - xDiff * 2)) / 2;

  getDiffSE = (yDiff: number, xDiff: number) => (yDiff + xDiff) / 2;

  getNewDimensions = (container: HTMLDivElement, yDiff: number, xDiff: number) => {
    const {resizeDimensions: oldDimensions, resizeDirection} = this.state;

    const diff = this['getDiff' + resizeDirection!.toUpperCase()](yDiff, xDiff);

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
      top: 0,
      left: 0,
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
    } else if (newDimensions.size < this.MIN_DIMENSION) {
      if (editingTop) {
        newDimensions.top = newDimensions.top + newDimensions.size - this.MIN_DIMENSION;
      }
      if (editingLeft) {
        newDimensions.left = newDimensions.left + newDimensions.size - this.MIN_DIMENSION;
      }
      newDimensions.size = this.MIN_DIMENSION;
    }

    return {...oldDimensions, ...newDimensions};
  };

  validateImage() {
    const img = this.image.current;

    if (!img) {
      return null;
    }

    if (img.naturalWidth < this.MIN_DIMENSION || img.naturalHeight < this.MIN_DIMENSION) {
      return tct('Please upload an image larger than [size]px by [size]px.', {
        size: this.MIN_DIMENSION - 1,
      });
    }

    if (img.naturalWidth > this.MAX_DIMENSION || img.naturalHeight > this.MAX_DIMENSION) {
      return tct('Please upload an image smaller than [size]px by [size]px.', {
        size: this.MAX_DIMENSION,
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
    const {savedDataUrl, model, type} = this.props;
    const uuid = model.avatar?.avatarUuid;
    const photoUrl = uuid && `/${AVATAR_URL_MAP[type] || 'avatar'}/${uuid}/`;

    return savedDataUrl || this.state.objectURL || photoUrl;
  }

  uploadClick = (ev: React.MouseEvent<HTMLAnchorElement>) => {
    ev.preventDefault();
    this.file.current && this.file.current.click();
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
        <p>{tct('[upload:Upload a photo] to get started.', {upload})}</p>
      </Well>
    );

    return (
      <React.Fragment>
        {!src && uploader}
        {src && <HiddenCanvas ref={this.canvas} />}
        {this.renderImageCrop()}
        <div className="form-group">
          {src && <a onClick={this.uploadClick}>{t('Change Photo')}</a>}
          <UploadInput
            ref={this.file}
            type="file"
            accept={this.ALLOWED_MIMETYPES}
            onChange={this.onSelectFile}
          />
        </div>
      </React.Fragment>
    );
  }
}

export default AvatarCropper;

const UploadInput = styled('input')`
  position: absolute;
  opacity: 0;
`;

const ImageCropper = styled('div')<{resizeDirection: Position | null}>`
  cursor: ${p => (p.resizeDirection ? `${p.resizeDirection}-resize` : 'default')};
  text-align: center;
  margin-bottom: 20px;
  background-size: 20px 20px;
  background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
  background-color: #fff;
  background-image: linear-gradient(45deg, #eee 25%, rgba(0, 0, 0, 0) 25%),
    linear-gradient(-45deg, #eee 25%, rgba(0, 0, 0, 0) 25%),
    linear-gradient(45deg, rgba(0, 0, 0, 0) 75%, #eee 75%),
    linear-gradient(-45deg, rgba(0, 0, 0, 0) 75%, #eee 75%);
`;

const CropContainer = styled('div')`
  display: inline-block;
  position: relative;
  max-width: 100%;
`;

const Cropper = styled('div')`
  position: absolute;
  border: 2px dashed ${p => p.theme.gray500};
`;

const Resizer = styled('div')<{position: Position}>`
  border-radius: 5px;
  width: 10px;
  height: 10px;
  position: absolute;
  background-color: ${p => p.theme.gray500};
  cursor: ${p => `${p.position}-resize`};
  ${p => resizerPositions[p.position].map(pos => `${pos}: -5px;`)}
`;

const HiddenCanvas = styled('canvas')`
  display: none;
`;
