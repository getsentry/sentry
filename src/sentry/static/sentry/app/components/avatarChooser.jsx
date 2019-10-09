import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import RadioGroup from 'app/views/settings/components/forms/controls/radioGroup';
import {t} from 'app/locale';
import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import withApi from 'app/utils/withApi';
import Well from 'app/components/well';
import {Panel, PanelBody, PanelHeader} from './panels';
import Avatar from './avatar';
import AvatarCropper from './avatarCropper';
import Button from './button';
import ExternalLink from './links/externalLink';
import LoadingError from './loadingError';
import LoadingIndicator from './loadingIndicator';

class AvatarChooser extends React.Component {
  static propTypes = {
    api: PropTypes.object,
    endpoint: PropTypes.string.isRequired,
    allowGravatar: PropTypes.bool,
    allowLetter: PropTypes.bool,
    allowUpload: PropTypes.bool,
    type: PropTypes.oneOf(['user', 'team', 'organization', 'project']),
    model: PropTypes.shape({
      avatar: PropTypes.shape({
        avatarType: PropTypes.oneOf(['upload', 'letter_avatar', 'gravatar']),
      }),
    }),
    // Is this a chooser for a User account?
    isUser: PropTypes.bool,
    savedDataUrl: PropTypes.string,
    onSave: PropTypes.func,
    disabled: PropTypes.bool,
  };

  static defaultProps = {
    allowGravatar: true,
    allowLetter: true,
    allowUpload: true,
    onSave: () => {},
  };

  constructor(props) {
    super(props);
    this.state = {
      model: this.props.model,
      savedDataUrl: null,
      dataUrl: null,
      hasError: false,
    };
  }

  componentWillReceiveProps(nextProps) {
    // Update local state if defined in props
    if (typeof nextProps.model !== 'undefined') {
      this.setState({model: nextProps.model});
    }
  }

  updateState(model) {
    this.setState({model});
  }

  updateDataUrlState = dataUrlState => {
    this.setState(dataUrlState);
  };

  handleError(msg) {
    addErrorMessage(msg);
  }

  handleSuccess(model) {
    const {onSave} = this.props;
    this.setState({model});
    onSave(model);
    addSuccessMessage(t('Successfully saved avatar preferences'));
  }

  handleSaveSettings = ev => {
    const {endpoint, api} = this.props;
    const {model, dataUrl} = this.state;
    ev.preventDefault();
    let data = {};
    const avatarType = model && model.avatar ? model.avatar.avatarType : undefined;
    const avatarPhoto = dataUrl ? dataUrl.split(',')[1] : undefined;

    data = {
      avatar_photo: avatarPhoto,
      avatar_type: avatarType,
    };

    api.request(endpoint, {
      method: 'PUT',
      data,
      success: resp => {
        this.setState({savedDataUrl: this.state.dataUrl});
        this.handleSuccess(resp);
      },
      error: this.handleError.bind(this, 'There was an error saving your preferences.'),
    });
  };

  handleChange(id) {
    const model = {...this.state.model};
    model.avatar.avatarType = id;
    this.updateState(model);
  }

  render() {
    const {
      allowGravatar,
      allowUpload,
      allowLetter,
      savedDataUrl,
      type,
      isUser,
      disabled,
    } = this.props;
    const {hasError, model} = this.state;

    if (hasError) {
      return <LoadingError />;
    }
    if (!model) {
      return <LoadingIndicator />;
    }

    const avatarType = (model.avatar && model.avatar.avatarType) || 'letter_avatar';
    const isLetter = avatarType === 'letter_avatar';
    // let isUpload = avatarType === 'upload';
    const isTeam = type === 'team';
    const isOrganization = type === 'organization';
    const isProject = type === 'project';
    const choices = [];

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
                disabled={disabled}
              />

              {isLetter && (
                <Avatar
                  gravatar={false}
                  style={{width: 90, height: 90}}
                  user={isUser ? model : null}
                  organization={isOrganization ? model : null}
                  project={isProject ? model : null}
                  team={isTeam ? model : null}
                />
              )}
            </AvatarGroup>

            <AvatarUploadSection>
              {allowGravatar && avatarType === 'gravatar' && (
                <Well>
                  {t('Gravatars are managed through ')}
                  <ExternalLink href="http://gravatar.com">Gravatar.com</ExternalLink>
                </Well>
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
                  disabled={disabled}
                >
                  {t('Save Avatar')}
                </Button>
              </AvatarSubmit>
            </AvatarUploadSection>
          </AvatarForm>
        </PanelBody>
      </Panel>
    );
  }
}

const AvatarGroup = styled('div')`
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

export default withApi(AvatarChooser);
