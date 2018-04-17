import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import styled from 'react-emotion';

import {Panel, PanelBody, PanelHeader} from './panels';
import {addErrorMessage, addSuccessMessage} from '../actionCreators/indicator';
import {t} from '../locale';
import ApiMixin from '../mixins/apiMixin';
import Avatar from './avatar';
import AvatarCropper from './avatarCropper';
import Button from './buttons/button';
import ExternalLink from './externalLink';
import LoadingError from './loadingError';
import LoadingIndicator from './loadingIndicator';
import RadioGroup from '../views/settings/components/forms/controls/radioGroup';

const AvatarChooser = createReactClass({
  displayName: 'AvatarChooser',

  propTypes: {
    endpoint: PropTypes.string.isRequired,
    allowGravatar: PropTypes.bool,
    allowLetter: PropTypes.bool,
    allowUpload: PropTypes.bool,
    model: PropTypes.shape({
      avatar: PropTypes.shape({
        avatarType: PropTypes.oneOf(['upload', 'letter_avatar', 'gravatar']),
      }),
    }),
    // Is this a chooser for a User account?
    isUser: PropTypes.bool,
    savedDataUrl: PropTypes.string,
    onSave: PropTypes.func,
  },

  mixins: [ApiMixin],

  getDefaultProps() {
    return {
      allowGravatar: true,
      allowLetter: true,
      allowUpload: true,
      onSave: () => {},
    };
  },

  getInitialState() {
    return {
      model: this.props.model,
      savedDataUrl: null,
      dataUrl: null,
      hasError: false,
    };
  },

  componentWillReceiveProps(nextProps) {
    // Update local state if defined in props
    if (typeof nextProps.model !== 'undefined') {
      this.setState({model: nextProps.model});
    }
  },

  updateState(model) {
    this.setState({model});
  },

  updateDataUrlState(dataUrlState) {
    this.setState(dataUrlState);
  },

  handleError(msg) {
    addErrorMessage(msg);
  },

  handleSuccess(model) {
    let {onSave} = this.props;
    this.setState({model});
    onSave(model);
    addSuccessMessage(t('Successfully saved avatar preferences'));
  },

  handleSaveSettings(ev) {
    let {endpoint, isUser} = this.props;
    let {model, dataUrl} = this.state;
    ev.preventDefault();
    let data = {};
    let avatarType = model && model.avatar ? model.avatar.avatarType : undefined;
    let avatarPhoto = dataUrl ? dataUrl.split(',')[1] : null;

    // User avatars have different keys than org/team/project
    if (isUser) {
      data = {
        avatar_photo: avatarPhoto,
        avatar_type: avatarType,
      };
    } else {
      data = {
        avatar: avatarPhoto,
        avatarType,
      };
    }

    this.api.request(endpoint, {
      method: 'PUT',
      data,
      success: resp => {
        this.setState({savedDataUrl: this.state.dataUrl});
        this.handleSuccess(resp);
      },
      error: this.handleError.bind(this, 'There was an error saving your preferences.'),
    });
  },

  handleChange(id) {
    let model = {...this.state.model};
    model.avatar.avatarType = id;
    this.updateState(model);
  },

  render() {
    let {allowGravatar, allowUpload, allowLetter, savedDataUrl, isUser} = this.props;
    let {hasError, model} = this.state;

    if (hasError) {
      return <LoadingError />;
    }
    if (!model) {
      return <LoadingIndicator />;
    }

    let avatarType = (model.avatar && model.avatar.avatarType) || 'letter_avatar';
    let isLetter = avatarType === 'letter_avatar';
    let choices = [];

    if (allowLetter) {
      choices.push(['letter_avatar', 'Use initials']);
    }
    if (allowUpload) {
      choices.push(['upload', 'Upload an image']);
    }
    if (allowGravatar) {
      choices.push(['gravatar', 'Use Gravatar']);
    }

    return (
      <Panel>
        <PanelHeader>Avatar</PanelHeader>
        <PanelBody>
          <AvatarForm>
            <AvatarGroup inline={isLetter}>
              <RadioGroup
                style={{flex: 1}}
                choices={choices}
                value={avatarType}
                label="Avatar Type"
                onChange={id => this.handleChange(id)}
              />

              {isLetter && (
                <Avatar
                  gravatar={false}
                  style={{width: 90, height: 90}}
                  user={isUser ? model : null}
                  model={isUser ? null : model}
                />
              )}
            </AvatarGroup>

            <AvatarUploadSection>
              {allowGravatar &&
                avatarType === 'gravatar' && (
                  <div className="well">
                    {t('Gravatars are managed through ')}
                    <ExternalLink href="http://gravatar.com">Gravatar.com</ExternalLink>
                  </div>
                )}

              {avatarType === 'upload' && (
                <AvatarCropper
                  {...this.props}
                  model={model}
                  savedDataUrl={savedDataUrl}
                  updateDataUrlState={this.updateDataUrlState}
                />
              )}
              <AvatarSubmit className="form-actions">
                <Button
                  type="button"
                  priority="primary"
                  onClick={this.handleSaveSettings}
                >
                  {t('Save Avatar')}
                </Button>
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

const AvatarForm = styled('div')`
  line-height: 1.5em;
  padding: 1em 1.25em;
`;

const AvatarSubmit = styled('fieldset')`
  display: flex;
  justify-content: flex-end;
  margin-top: 1em;
`;

const AvatarUploadSection = styled('div')`
  margin-top: 1em;
`;

export default AvatarChooser;
