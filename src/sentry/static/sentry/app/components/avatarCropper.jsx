import $ from 'jquery';
import PropTypes from 'prop-types';
import React from 'react';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {AVATAR_URL_MAP} from 'app/constants';
import {t} from 'app/locale';
import Well from 'app/components/well';

class AvatarCropper extends React.Component {
  static propTypes = {
    model: PropTypes.object.isRequired,
    updateDataUrlState: PropTypes.func.isRequired,
    type: PropTypes.oneOf(['user', 'team', 'organization', 'project']),
    savedDataUrl: PropTypes.string,
  };

  constructor(...args) {
    super(...args);
    this.state = {
      mousePosition: {
        pageX: null,
        pageY: null,
      },
      resizeDimensions: {
        top: 0,
        left: 0,
        size: 0,
      },
    };
  }

  componentWillUnmount() {
    this.revokeObjectUrl();
  }

  MIN_DIMENSION = 256;
  MAX_DIMENSION = 1024;

  onChange = ev => {
    /*eslint consistent-return:0*/
    const file = ev.target.files[0];

    if (!file) return; // No file selected (e.g. user clicked "cancel")

    if (!/^image\//.test(file.type))
      return void this.handleError('That is not a supported file type.');

    this.revokeObjectUrl();
    this.setState(
      {
        file,
        objectURL: window.URL.createObjectURL(file),
      },
      () => {
        this.props.updateDataUrlState({savedDataUrl: null});
      }
    );
  };

  revokeObjectUrl = () => {
    this.state.objectURL && window.URL.revokeObjectURL(this.state.objectURL);
  };

  updateDimensions = ev => {
    if (!this.cropContainer) return;

    const $container = $(this.cropContainer);
    const resizeDimensions = this.state.resizeDimensions;
    let pageY = ev.pageY;
    let pageX = ev.pageX;
    let top = resizeDimensions.top + (pageY - this.state.mousePosition.pageY);
    let left = resizeDimensions.left + (pageX - this.state.mousePosition.pageX);
    if (top < 0) {
      top = 0;
      pageY = this.state.mousePosition.pageY;
    } else if (top + resizeDimensions.size > $container.height()) {
      top = $container.height() - resizeDimensions.size;
      pageY = this.state.mousePosition.pageY;
    }
    if (left < 0) {
      left = 0;
      pageX = this.state.mousePosition.pageX;
    } else if (left + resizeDimensions.size > $container.width()) {
      left = $container.width() - resizeDimensions.size;
      pageX = this.state.mousePosition.pageX;
    }
    this.setState({
      resizeDimensions: Object.assign({}, resizeDimensions, {top, left}),
      mousePosition: {pageX, pageY},
    });
  };

  startMove = () => {
    $(document).on('mousemove', this.updateDimensions);
    $(document).on('mouseup', this.onMouseUp);
  };

  stopMove = () => {
    $(document).off('mousemove', this.updateDimensions);
    $(document).off('mouseup', this.onMouseUp);
    this.drawToCanvas();
  };

  onMouseDown = ev => {
    ev.preventDefault();
    this.setState({
      mousePosition: {
        pageY: ev.pageY,
        pageX: ev.pageX,
      },
    });
    this.startMove();
  };

  onMouseUp = ev => {
    ev.preventDefault();
    this.stopMove();
  };

  startResize = (direction, ev) => {
    ev.stopPropagation();
    ev.preventDefault();
    $(document).on('mousemove', this.updateSize);
    $(document).on('mouseup', this.stopResize);
    this.setState({
      resizeDirection: direction,
      mousePosition: {
        pageY: ev.pageY,
        pageX: ev.pageX,
      },
    });
  };

  stopResize = ev => {
    ev.stopPropagation();
    ev.preventDefault();
    $(document).off('mousemove', this.updateSize);
    $(document).off('mouseup', this.stopResize);
    this.drawToCanvas();
  };

  updateSize = ev => {
    if (!this.cropContainer) return;

    const yDiff = ev.pageY - this.state.mousePosition.pageY;
    const xDiff = ev.pageX - this.state.mousePosition.pageX;
    const $container = $(this.cropContainer);

    this.setState({
      resizeDimensions: this.getNewDimensions($container, yDiff, xDiff),
      mousePosition: {pageX: ev.pageX, pageY: ev.pageY},
    });
  };

  // Normalize diff accross dimensions so that negative diffs
  // are always making the cropper smaller and positive ones
  // are making the cropper larger
  getDiffNW = (yDiff, xDiff) => {
    return (yDiff - yDiff * 2 + (xDiff - xDiff * 2)) / 2;
  };

  getDiffNE = (yDiff, xDiff) => {
    return (yDiff - yDiff * 2 + xDiff) / 2;
  };

  getDiffSW = (yDiff, xDiff) => {
    return (yDiff + (xDiff - xDiff * 2)) / 2;
  };

  getDiffSE = (yDiff, xDiff) => {
    return (yDiff + xDiff) / 2;
  };

  getNewDimensions = ($container, yDiff, xDiff) => {
    const oldDimensions = this.state.resizeDimensions;
    const resizeDirection = this.state.resizeDirection;
    const diff = this['getDiff' + resizeDirection.toUpperCase()](yDiff, xDiff);

    let height = $container.height() - oldDimensions.top;
    let width = $container.width() - oldDimensions.left;

    // Depending on the direction, we update different dimensions:
    // nw: size, top, left
    // ne: size, top
    // sw: size, left
    // se: size
    const editingTop = resizeDirection === 'nw' || resizeDirection === 'ne';
    const editingLeft = resizeDirection === 'nw' || resizeDirection === 'sw';
    const newDimensions = {size: oldDimensions.size + diff};
    if (editingTop) {
      newDimensions.top = oldDimensions.top - diff;
      height = $container.height() - newDimensions.top;
    }

    if (editingLeft) {
      newDimensions.left = oldDimensions.left - diff;
      width = $container.width() - newDimensions.left;
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
    return Object.assign({}, oldDimensions, newDimensions);
  };

  handleError = msg => {
    addErrorMessage(t(msg));
  };

  validateImage = () => {
    const img = this.image;
    if (!img) return;
    if (img.naturalWidth < this.MIN_DIMENSION || img.naturalHeight < this.MIN_DIMENSION) {
      return (
        'Please upload an image larger than ' +
        (this.MIN_DIMENSION - 1) +
        'px by ' +
        (this.MIN_DIMENSION - 1) +
        'px.'
      );
    }
    if (img.naturalWidth > this.MAX_DIMENSION || img.naturalHeight > this.MAX_DIMENSION) {
      return (
        'Please upload an image smaller than ' +
        this.MAX_DIMENSION +
        'px by ' +
        this.MAX_DIMENSION +
        'px.'
      );
    }
  };

  onLoad = ev => {
    const error = this.validateImage();
    if (error) {
      window.URL.revokeObjectURL(this.state.objectURL);
      this.setState({objectURL: null});
      this.handleError(error);
      return;
    }
    if (!this.image) return;

    const $img = $(this.image);
    const dimension = Math.min($img.height(), $img.width());
    this.setState(
      {
        resizeDimensions: Object.assign({size: dimension, top: 0, left: 0}),
      },
      this.drawToCanvas
    );
  };

  drawToCanvas = () => {
    const canvas = this.canvas;
    if (!canvas) return;
    if (!this.image) return;
    const resizeDimensions = this.state.resizeDimensions;
    const img = this.image;
    // Calculate difference between natural dimensions and rendered dimensions
    const imgRatio =
      (img.naturalHeight / $(img).height() + img.naturalWidth / $(img).width()) / 2;
    canvas.width = resizeDimensions.size * imgRatio;
    canvas.height = resizeDimensions.size * imgRatio;
    canvas
      .getContext('2d')
      .drawImage(
        img,
        resizeDimensions.left * imgRatio,
        resizeDimensions.top * imgRatio,
        resizeDimensions.size * imgRatio,
        resizeDimensions.size * imgRatio,
        0,
        0,
        resizeDimensions.size * imgRatio,
        resizeDimensions.size * imgRatio
      );
    this.finishCrop();
  };

  finishCrop = () => {
    const canvas = this.canvas;
    if (!canvas) return;
    this.props.updateDataUrlState({dataUrl: canvas.toDataURL()});
  };

  getImgSrc = () => {
    const {savedDataUrl, model, type} = this.props;
    const uuid = model && model.avatar.avatarUuid;
    const photoUrl = uuid && `/${AVATAR_URL_MAP[type] || 'avatar'}/${uuid}/`;
    return savedDataUrl || this.state.objectURL || photoUrl;
  };

  onImgDrag = ev => {
    ev.preventDefault();
  };

  renderImageCrop = () => {
    const src = this.getImgSrc();
    if (!src) {
      return null;
    }
    const resizeDimensions = this.state.resizeDimensions;
    const style = {
      top: resizeDimensions.top,
      left: resizeDimensions.left,
      width: resizeDimensions.size,
      height: resizeDimensions.size,
    };
    return (
      <div className="image-cropper">
        <div className="crop-container" ref={ref => (this.cropContainer = ref)}>
          <div className="image-container">
            <img
              className="preview"
              ref={ref => (this.image = ref)}
              src={src}
              onLoad={this.onLoad}
              onDragStart={this.onImgDrag}
            />
          </div>
          <div className="cropper" style={style} onMouseDown={this.onMouseDown}>
            <div onMouseDown={this.startResize.bind(this, 'nw')} className="resizer nw" />
            <div onMouseDown={this.startResize.bind(this, 'ne')} className="resizer ne" />
            <div onMouseDown={this.startResize.bind(this, 'se')} className="resizer se" />
            <div onMouseDown={this.startResize.bind(this, 'sw')} className="resizer sw" />
          </div>
        </div>
      </div>
    );
  };

  uploadClick = ev => {
    ev.preventDefault();
    if (!this.file) return;
    this.file.click();
  };

  renderCanvas = () => {
    if (!this.getImgSrc()) {
      return null;
    }
    return (
      <div className="canvas-container">
        <canvas ref={ref => (this.canvas = ref)} />
      </div>
    );
  };

  render() {
    const src = this.getImgSrc();
    const style = {
      position: 'absolute',
      opacity: 0,
    };

    return (
      <div>
        {!src && (
          <Well hasImage centered>
            <p>
              <a onClick={this.uploadClick}>
                <strong>Upload a photo</strong>
              </a>{' '}
              to get started.
            </p>
          </Well>
        )}
        {this.renderImageCrop()}
        {this.renderCanvas()}
        <div className="form-group">
          {src && <a onClick={this.uploadClick}>{t('Change Photo')}</a>}
          <input
            ref={ref => (this.file = ref)}
            type="file"
            accept="image/gif,image/jpeg,image/png"
            onChange={this.onChange}
            style={style}
          />
        </div>
      </div>
    );
  }
}

export default AvatarCropper;
