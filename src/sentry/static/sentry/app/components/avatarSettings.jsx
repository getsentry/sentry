import React from 'react';

import AlertActions from '../actions/alertActions';
import ApiMixin from '../mixins/apiMixin';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import {t} from '../locale';


const AvatarCropper = React.createClass({
  propTypes: {
    user: React.PropTypes.object.isRequired,
    updateDataUrlState: React.PropTypes.func.isRequired,
    savedDataUrl: React.PropTypes.string
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      error: null,
      mousePosition: {
        pageX: null,
        pageY: null
      },
      resizeDimensions: {
        top: 0,
        left: 0,
        size: 0
      }
    };
  },

  MIN_DIMENSION: 256,

  MAX_DIMENSION: 1024,

  onChange(ev) {
    let file = ev.target.files[0];

    if (!/^image\//.test(file.type))
      return void this.setState({error: 'That is not a supported file type.'});

    this.state.objectURL && window.URL.revokeObjectURL(this.state.objectURL);
    this.setState({
      file: file,
      objectURL: window.URL.createObjectURL(file)
    }, () => {
      this.props.updateDataUrlState({savedDataUrl: null});
    });
  },

  componentWIllUnmount() {
    this.state.objectURL && window.URL.revokeObjectURL(this.state.objectURL);
  },

  updateDimensions(ev) {
    let $container = $(this.refs.cropContainer);
    let resizeDimensions = this.state.resizeDimensions;
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
      mousePosition: {pageX, pageY}
    });
  },

  startMove() {
    $(document).on('mousemove', this.updateDimensions);
    $(document).on('mouseup', this.onMouseUp);
  },

  stopMove() {
    $(document).off('mousemove', this.updateDimensions);
    $(document).off('mouseup', this.onMouseUp);
    this.drawToCanvas();
  },

  onMouseDown(ev) {
    ev.preventDefault();
    this.setState({mousePosition: {
      pageY: ev.pageY,
      pageX: ev.pageX
    }});
    this.startMove();
  },

  onMouseUp(ev) {
    ev.preventDefault();
    this.stopMove();
  },

  startResize(direction, ev) {
    ev.stopPropagation();
    ev.preventDefault();
    $(document).on('mousemove', this.updateSize);
    $(document).on('mouseup', this.stopResize);
    this.setState({
      resizeDirection: direction,
      mousePosition: {
        pageY: ev.pageY,
        pageX: ev.pageX
      }
    });
  },

  stopResize(ev) {
    ev.stopPropagation();
    ev.preventDefault();
    $(document).off('mousemove', this.updateSize);
    $(document).off('mouseup', this.stopResize);
    this.drawToCanvas();
  },

  updateSize(ev) {
    let yDiff = ev.pageY - this.state.mousePosition.pageY;
    let xDiff = ev.pageX - this.state.mousePosition.pageX;
    let $container = $(this.refs.cropContainer);

    this.setState({
      resizeDimensions: this.getNewDimensions($container, yDiff, xDiff),
      mousePosition: {pageX: ev.pageX, pageY: ev.pageY}
    });
  },

  // Normalize diff accross dimensions so that negative diffs
  // are always making the cropper smaller and positive ones
  // are making the cropper larger
  getDiffNW(yDiff, xDiff) {
    return ((yDiff - (yDiff * 2)) + (xDiff - (xDiff * 2))) / 2;
  },

  getDiffNE(yDiff, xDiff) {
    return ((yDiff - (yDiff * 2)) + xDiff) / 2;
  },

  getDiffSW(yDiff, xDiff) {
    return (yDiff + (xDiff - (xDiff * 2))) / 2;
  },

  getDiffSE(yDiff, xDiff) {
    return (yDiff + xDiff) / 2;
  },

  getNewDimensions($container, yDiff, xDiff) {
    let oldDimensions = this.state.resizeDimensions;
    let resizeDirection = this.state.resizeDirection;
    let diff = this['getDiff' + resizeDirection.toUpperCase()](yDiff, xDiff);

    let height = $container.height() - oldDimensions.top;
    let width = $container.width() - oldDimensions.left;

    // Depending on the direction, we update different dimensions:
    // nw: size, top, left
    // ne: size, top
    // sw: size, left
    // se: size
    let newDimensions = {size: oldDimensions.size + diff};
    if (resizeDirection === 'nw' || resizeDirection === 'ne') {
      newDimensions.top = oldDimensions.top - diff;
      height = $container.height() - newDimensions.top;
    }

    if (resizeDirection === 'nw' || resizeDirection === 'sw') {
      newDimensions.left = oldDimensions.left - diff;
      width = $container.width() - newDimensions.left;
    }

    if (newDimensions.top < 0) {
      newDimensions.size = newDimensions.size + newDimensions.top;
      // Only update left if it's something we edit in this direction
      if (newDimensions.hasOwnProperty('left')) {
        newDimensions.left = newDimensions.left - newDimensions.top;
      }
      newDimensions.top = 0;
    }

    if (newDimensions.left < 0) {
      newDimensions.size = newDimensions.size + newDimensions.left;
      // Only update top if it's something we edit in this direction
      if (newDimensions.hasOwnProperty('top')) {
        newDimensions.top = newDimensions.top - newDimensions.left;
      }
      newDimensions.left = 0;
    }

    let maxSize = Math.min(width, height);
    if (newDimensions.size > maxSize) {
      if (newDimensions.hasOwnProperty('top')) {
        newDimensions.top = newDimensions.top + newDimensions.size - maxSize;
      }
      if (newDimensions.hasOwnProperty('left')) {
        newDimensions.left = newDimensions.left + newDimensions.size - maxSize;
      }
      newDimensions.size = maxSize;
    } else if (newDimensions.size < this.MIN_DIMENSION) {
      if (newDimensions.hasOwnProperty('top')) {
        newDimensions.top = newDimensions.top + newDimensions.size - this.MIN_DIMENSION;
      }
      if (newDimensions.hasOwnProperty('left')) {
        newDimensions.left = newDimensions.left + newDimensions.size - this.MIN_DIMENSION;
      }
      newDimensions.size = this.MIN_DIMENSION;
    }
    return Object.assign({}, oldDimensions, newDimensions);
  },

  handleError(msg) {
    AlertActions.addAlert({
      message: t(msg),
      type: 'error'
    });
  },

  validateImage() {
    let img = this.refs.image;
    if (img.naturalWidth < this.MIN_DIMENSION ||
          img.naturalHeight < this.MIN_DIMENSION) {
      return ('Please upload an image larger than ' +
              this.MIN_DIMENSION + 'px by ' + this.MIN_DIMENSION + 'px.');
    }
    if (img.naturalWidth > this.MAX_DIMENSION ||
          img.naturalHeight > this.MAX_DIMENSION) {
      return ('Please upload an image smaller than ' +
              this.MAX_DIMENSION + 'px by ' + this.MAX_DIMENSION + 'px.');
    }
  },

  onLoad(ev) {
    let error = this.validateImage();
    if (error) {
      window.URL.revokeObjectURL(this.state.objectURL);
      this.setState({objectURL: null});
      this.handleError(error);
      return;
    }
    let $img = $(this.refs.image);
    let dimension = Math.min($img.height(), $img.width());
    this.setState({
      resizeDimensions: Object.assign({size: dimension, top: 0, left: 0})
    }, this.drawToCanvas);
  },

  drawToCanvas() {
    let canvas = this.refs.canvas;
    let resizeDimensions = this.state.resizeDimensions;
    let img = this.refs.image;
    // Calculate difference between natural dimensions and rendered dimensions
    let imgRatio = (img.naturalHeight / $(img).height() +
                    img.naturalWidth / $(img).width()) / 2;
    canvas.width = resizeDimensions.size * imgRatio;
    canvas.height = resizeDimensions.size * imgRatio;
    canvas.getContext('2d').drawImage(img,
                                      resizeDimensions.left * imgRatio,
                                      resizeDimensions.top * imgRatio,
                                      resizeDimensions.size * imgRatio,
                                      resizeDimensions.size * imgRatio,
                                      0, 0,
                                      resizeDimensions.size * imgRatio,
                                      resizeDimensions.size * imgRatio);
    this.finishCrop();
  },

  finishCrop() {
    let canvas = this.refs.canvas;
    this.props.updateDataUrlState({dataUrl: canvas.toDataURL()});
  },

  getImgSrc() {
    let uuid = this.props.user.avatar.avatarUuid;
    let photoUrl = uuid && '/avatar/' + uuid + '/';
    return this.props.savedDataUrl || this.state.objectURL || photoUrl;
  },

  onImgDrag(ev) {
    ev.preventDefault();
  },

  renderImageCrop() {
    let src = this.getImgSrc();
    if (!src) {
      return null;
    }
    let resizeDimensions = this.state.resizeDimensions;
    let style = {
      top: resizeDimensions.top,
      left: resizeDimensions.left,
      width: resizeDimensions.size,
      height: resizeDimensions.size
    };
    return (
      <div className="image-cropper">
        <div className="crop-container" ref="cropContainer">
          <div className="image-container">
            <img className="preview" ref="image" src={src}
                 onLoad={this.onLoad} onDragStart={this.onImgDrag}/>
          </div>
          <div className="cropper" style={style} onMouseDown={this.onMouseDown}>
            <div onMouseDown={this.startResize.bind(this, 'nw')} className="resizer nw"></div>
            <div onMouseDown={this.startResize.bind(this, 'ne')} className="resizer ne"></div>
            <div onMouseDown={this.startResize.bind(this, 'se')} className="resizer se"></div>
            <div onMouseDown={this.startResize.bind(this, 'sw')} className="resizer sw"></div>
          </div>
        </div>
      </div>
    );
  },

  uploadClick(ev) {
    ev.preventDefault();
    this.refs.file.click();
  },

  renderCanvas() {
    if (!this.getImgSrc()) {
      return null;
    }
    return (
      <div className="canvas-container">
        <canvas ref="canvas"></canvas>
      </div>
    );
  },

  render() {
    let src = this.getImgSrc();
    let style = {
        position : "absolute"
    };

    return (
      <div>
        {!src &&
        <div className="image-well well blankslate">
          <p><a onClick={this.uploadClick}><strong>{t('Upload a photo')}</strong></a>{t(' to get started.')}</p>
        </div>}
        {this.renderImageCrop()}
        {this.renderCanvas()}
        <div className="form-group">
          {src && <a onClick={this.uploadClick}>{t('Change Photo')}</a>}
          <input ref="file" type="file" accept="image/*" onChange={this.onChange} style={style}/>
        </div>
      </div>
    );
  }
});

const AvatarRadio = React.createClass({
  propTypes: {
    user: React.PropTypes.object.isRequired,
    updateUser: React.PropTypes.func.isRequired
  },

  OPTIONS: {
    upload: 'Upload a Photo',
    gravatar: 'Use Gravatar',
    letter_avatar: 'Use Letter Avatar'
  },

  onChange(ev) {
    let avatar = Object.assign({}, this.props.user.avatar, {avatarType: ev.target.value});
    this.props.user.avatar = avatar;
    this.props.updateUser(this.props.user);
  },

  render() {
    let radios = [];
    for (let opt in this.OPTIONS) {
      radios.push(
        <li className="radio" key={opt}>
          <label>
            <input type="radio" name="avatar-type" value={opt} onChange={this.onChange}
                   checked={this.props.user.avatar.avatarType === opt}/>
            {this.OPTIONS[opt]}
          </label>
        </li>
      );
    }
    return (
      <div>
        <legend>{t('Avatar Type')}</legend>
        <ul className="radio-inputs">
          {radios}
        </ul>
      </div>
    );
  }
});

const AvatarSettings = React.createClass({
  propTypes: {
    userId: React.PropTypes.number
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      user: null,
      savedDataUrl: null,
      dataUrl: null,
      hasError: false
    };
  },

  componentDidMount() {
    this.api.request(this.getPhotoEndpoint(), {
      method: 'GET',
      success: this.updateUserState,
      error: () => {
        this.setState({hasError: true});
      }
    });
  },

  getOptionsEndpoint() {
    return '/users/me/options/';
  },

  getPhotoEndpoint() {
    return '/users/me/avatar/';
  },

  updateUserState(user) {
    this.setState({user: user});
  },

  updateDataUrlState(dataUrlState) {
    this.setState(dataUrlState);
  },

  handleError(msg) {
    AlertActions.addAlert({
      message: t(msg),
      type: 'error'
    });
  },

  handleSuccess(user) {
    this.setState({user: user});
    AlertActions.addAlert({
      message: t('Successfully saved avatar preferences'),
      type: 'success'
    });
  },

  saveSettings(ev) {
    ev.preventDefault();
    let avatarPhoto = null;
    if (this.state.dataUrl) {
      avatarPhoto = this.state.dataUrl.split(',')[1];
    }
    this.api.request(this.getPhotoEndpoint(), {
      method: 'PUT',
      data: {
        avatar_photo: avatarPhoto,
        avatar_type: this.state.user.avatar.avatarType
      },
      success: (user) => {
        this.setState({savedDataUrl: this.state.dataUrl});
        this.handleSuccess(user);
      },
      error: this.handleError.bind(this, 'There was an error saving your preferences.')
    });
  },

  render() {
    if (this.state.hasError) {
      return <LoadingError />;
    }
    if (!this.state.user) {
      return <LoadingIndicator/>;
    }

    let gravatarMessage = <div className="well">Gravatars are managed through <a href="http://gravatar.com" target="_blank">Gravatar.com</a></div>;

    return (
      <div>
        <form>
          <AvatarRadio user={this.state.user} updateUser={this.updateUserState}/>

          {this.state.user.avatar.avatarType ==='gravatar' && gravatarMessage }

          {this.state.user.avatar.avatarType === 'upload' &&
            <AvatarCropper {...this.props} user={this.state.user} savedDataUrl={this.state.savedDataUrl}
                           updateDataUrlState={this.updateDataUrlState}/>}
          <fieldset className="form-actions">
            <button className="btn btn-primary" onClick={this.saveSettings}>{t('Done')}</button>
          </fieldset>
        </form>
      </div>
    );
  }
});

export default AvatarSettings;
