import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import styled from 'react-emotion';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {t} from 'app/locale';
import ApiMixin from 'app/mixins/apiMixin';
import Avatar from 'app/components/avatar';
import AvatarCropper from 'app/components/avatarCropper';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import RadioGroup from 'app/views/settings/components/forms/controls/radioGroup';
import SentryTypes from 'app/sentryTypes';
import Well from 'app/components/well';

const AccountAvatar = createReactClass({
  displayName: 'AccountAvatar',

  propTypes: {
    userId: PropTypes.number,
    user: SentryTypes.User,
    onSave: PropTypes.func,
  },

  mixins: [ApiMixin],

  getDefaultProps() {
    return {
      onSave: () => {},
    };
  },

  getInitialState() {
    return {
      user: this.props.user,
      savedDataUrl: null,
      dataUrl: null,
      hasError: false,
    };
  },

  componentWillReceiveProps(nextProps) {
    // Update local state if defined in props
    if (typeof nextProps.user !== 'undefined') {
      this.setState({user: nextProps.user});
    }
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
    addErrorMessage(t(msg));
  },

  handleSuccess(user) {
    const {onSave} = this.props;
    this.setState({user});
    onSave(user);
    addSuccessMessage(t('Successfully saved avatar preferences'));
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
    const user = {...this.state.user};
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

    const gravatarMessage = (
      <Well>
        {t('Gravatars are managed through ')}
        <a href="http://gravatar.com" target="_blank" rel="noreferrer noopener">
          Gravatar.com
        </a>
      </Well>
    );

    const isLetter = this.state.user.avatar.avatarType == 'letter_avatar';

    return (
      <Panel>
        <PanelHeader>Avatar</PanelHeader>
        <PanelBody>
          <AvatarForm>
            <AvatarGroup inline={isLetter}>
              <RadioGroup
                style={{flex: 1}}
                choices={[
                  ['letter_avatar', 'Use my initials'],
                  ['upload', 'Upload a Photo'],
                  ['gravatar', 'Use Gravatar'],
                ]}
                value={this.state.user.avatar.avatarType || 'letter_avatar'}
                label="Avatar Type"
                onChange={id => this.handleChange(id)}
              />

              {isLetter && (
                <Avatar
                  gravatar={false}
                  style={{width: 90, height: 90}}
                  user={this.state.user}
                />
              )}
            </AvatarGroup>

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
                  {t('Save Avatar')}
                </button>
              </AvatarSubmit>
            </AvatarUploadSection>
          </AvatarForm>
        </PanelBody>
      </Panel>
    );
  },
});

const AvatarGroup = styled.div`
  display: flex;
  flex-direction: ${p => (p.inline ? 'row' : 'column')};
`;

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

export default AccountAvatar;
