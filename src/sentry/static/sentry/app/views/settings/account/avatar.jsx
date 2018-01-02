import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';
import createReactClass from 'create-react-class';

import Panel from '../components/panel';
import PanelBody from '../components/panelBody';
import PanelHeader from '../components/panelHeader';
import AlertActions from '../../../actions/alertActions';
import ApiMixin from '../../../mixins/apiMixin';
import AvatarCropper from '../../../components/avatarCropper';
import RadioGroup from '../components/forms/radioGroup';
import LoadingError from '../../../components/loadingError';
import LoadingIndicator from '../../../components/loadingIndicator';
import {t} from '../../../locale';

const AvatarSettings = createReactClass({
  displayName: 'AvatarSettings',

  propTypes: {
    userId: PropTypes.number,
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      user: null,
      savedDataUrl: null,
      dataUrl: null,
      hasError: false,
    };
  },

  componentDidMount() {
    this.api.request(this.getEndpoint(), {
      method: 'GET',
      success: this.updateUserState,
      error: () => {
        this.setState({hasError: true});
      },
    });
  },

  getEndpoint() {
    return '/users/me/avatar/';
  },

  updateUserState(user) {
    this.setState({user});
  },

  updateDataUrlState(dataUrlState) {
    this.setState(dataUrlState);
  },

  handleError(msg) {
    AlertActions.addAlert({
      message: t(msg),
      type: 'error',
    });
  },

  handleSuccess(user) {
    this.setState({user});
    AlertActions.addAlert({
      message: t('Successfully saved avatar preferences'),
      type: 'success',
      expireAfrer: 3000,
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
        avatar_type: this.state.user.avatar.avatarType,
      },
      success: user => {
        this.setState({savedDataUrl: this.state.dataUrl});
        this.handleSuccess(user);
      },
      error: this.handleError.bind(this, 'There was an error saving your preferences.'),
    });
  },

  handleChange(id) {
    let user = {...this.state.user};
    user.avatar.avatarType = id;
    this.updateUserState(user);
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
        <a href="http://gravatar.com" target="_blank" rel="noreferrer noopener">
          Gravatar.com
        </a>
      </div>
    );

    return (
      <Panel>
        <PanelHeader>Avatar</PanelHeader>
        <PanelBody>
          <AvatarForm>
            <RadioGroup
              choices={[
                ['letter_avatar', 'Use my initials'],
                ['upload', 'Upload a Photo'],
                ['gravatar', 'Use Gravatar'],
              ]}
              value={this.state.user.avatar.avatarType || 'letter_avatar'}
              label="Avatar Type"
              onChange={id => this.handleChange(id)}
            />

            <AvatarUploadSection>
              {this.state.user.avatar.avatarType === 'gravatar' && gravatarMessage}

              {this.state.user.avatar.avatarType === 'upload' && (
                <AvatarCropper
                  {...this.props}
                  user={this.state.user}
                  savedDataUrl={this.state.savedDataUrl}
                  updateDataUrlState={this.updateDataUrlState}
                />
              )}
              <AvatarSubmit className="form-actions">
                <button className="btn btn-primary" onClick={this.saveSettings}>
                  {t('Done')}
                </button>
              </AvatarSubmit>
            </AvatarUploadSection>
          </AvatarForm>
        </PanelBody>
      </Panel>
    );
  },
});

const AvatarForm = styled('form')`
  line-height: 1.5em;
  padding: 1em 1.25em;
`;

const AvatarSubmit = styled('fieldset')`
  margin-top: 1em;
`;

const AvatarUploadSection = styled('div')`
  margin-top: 1em;
`;

export default AvatarSettings;
