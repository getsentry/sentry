import React from 'react';

import AlertActions from '../actions/alertActions';
import ApiMixin from '../mixins/apiMixin';
import AvatarCropper from '../components/avatarCropper';
import AvatarRadio from '../components/avatarRadio';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import {t} from '../locale';


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
    this.api.request(this.getEndpoint(), {
      method: 'GET',
      success: this.updateUserState,
      error: () => {
        this.setState({hasError: true});
      }
    });
  },

  getEndpoint() {
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
      type: 'success',
      expireAfrer: 3000
    });
  },

  saveSettings(ev) {
    ev.preventDefault();
    let avatarPhoto = null;
    if (this.state.dataUrl) {
      avatarPhoto = this.state.dataUrl.split(',')[1];
    }
    this.api.request(this.getEndpoint(), {
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
      return <LoadingIndicator />;
    }

    let gravatarMessage = (
      <div className="well">
        {t('Gravatars are managed through ')}
        <a href="http://gravatar.com" target="_blank">Gravatar.com</a>
      </div>
    );

    return (
      <div>
        <form>
          <AvatarRadio user={this.state.user} updateUser={this.updateUserState}/>

          {this.state.user.avatar.avatarType === 'gravatar' && gravatarMessage}

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
