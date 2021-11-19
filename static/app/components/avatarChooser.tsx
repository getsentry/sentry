import * as React from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {Client} from 'app/api';
import Avatar from 'app/components/avatar';
import AvatarCropper from 'app/components/avatarCropper';
import Button from 'app/components/button';
import ExternalLink from 'app/components/links/externalLink';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import Well from 'app/components/well';
import {t} from 'app/locale';
import {AvatarUser, Organization, SentryApp, Team} from 'app/types';
import withApi from 'app/utils/withApi';
import RadioGroup from 'app/views/settings/components/forms/controls/radioGroup';

export type Model = Pick<AvatarUser, 'avatar'>;
type AvatarType = Required<Model>['avatar']['avatarType'];
type AvatarChooserType =
  | 'user'
  | 'team'
  | 'organization'
  | 'sentryAppColor'
  | 'sentryAppSimple';
type DefaultChoice = {
  avatar?: React.ReactNode;
  allowDefault?: boolean;
  choiceText?: string;
};

type DefaultProps = {
  onSave: (model: Model) => void;
  allowGravatar?: boolean;
  allowLetter?: boolean;
  allowUpload?: boolean;
  type?: AvatarChooserType;
  defaultChoice?: DefaultChoice;
};

type Props = {
  api: Client;
  endpoint: string;
  model: Model;
  disabled?: boolean;
  savedDataUrl?: string;
  isUser?: boolean;
  /**
   * Title in the PanelHeader component (default: 'Avatar')
   */
  title?: string;
  extraFields?: {[key: string]: any};
} & DefaultProps;

type State = {
  model: Model;
  hasError: boolean;
  savedDataUrl?: string | null;
  dataUrl?: string | null;
};

class AvatarChooser extends React.Component<Props, State> {
  static defaultProps: DefaultProps = {
    allowGravatar: true,
    allowLetter: true,
    allowUpload: true,
    type: 'user',
    onSave: () => {},
    defaultChoice: {
      allowDefault: false,
    },
  };

  state: State = {
    model: this.props.model,
    savedDataUrl: null,
    dataUrl: null,
    hasError: false,
  };

  UNSAFE_componentWillReceiveProps(nextProps: Props) {
    // Update local state if defined in props
    if (typeof nextProps.model !== 'undefined') {
      this.setState({model: nextProps.model});
    }
  }

  updateState(model: Model) {
    this.setState({model});
  }

  handleError(msg: string) {
    addErrorMessage(msg);
  }

  handleSuccess(model: Model) {
    const {onSave} = this.props;
    this.setState({model});
    onSave(model);
    addSuccessMessage(t('Successfully saved avatar preferences'));
  }

  handleSaveSettings = (ev: React.MouseEvent) => {
    const {endpoint, api, type} = this.props;
    const {model, dataUrl} = this.state;
    const isSentryApp = type?.startsWith('sentryApp');

    ev.preventDefault();
    const avatarType = model && model.avatar ? model.avatar.avatarType : undefined;
    const avatarPhoto = dataUrl ? dataUrl.split(',')[1] : undefined;

    // TODO(Leander): Fix this payload's type
    const data: any = {
      avatar_photo: avatarPhoto,
      avatar_type: avatarType,
    };

    if (isSentryApp) {
      data.color = type === 'sentryAppColor';
    }

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

  handleChange = (id: AvatarType) =>
    this.updateState({
      ...this.state.model,
      avatar: {avatarUuid: this.state.model.avatar?.avatarUuid ?? '', avatarType: id},
    });

  render() {
    const {
      allowGravatar,
      allowUpload,
      allowLetter,
      savedDataUrl,
      type,
      isUser,
      disabled,
      title,
      defaultChoice,
    } = this.props;
    const {hasError, model} = this.state;

    if (hasError) {
      return <LoadingError />;
    }
    if (!model) {
      return <LoadingIndicator />;
    }
    const {
      allowDefault,
      avatar: defaultAvatar,
      choiceText: defaultChoiceText,
    } = defaultChoice || {};

    const avatarType = model.avatar?.avatarType ?? 'letter_avatar';
    const isLetter = avatarType === 'letter_avatar';
    const isDefault = defaultAvatar !== undefined && avatarType === 'default';

    const isTeam = type === 'team';
    const isOrganization = type === 'organization';
    const isSentryApp = type?.startsWith('sentryApp');

    const choices: [AvatarType, string][] = [];

    if (allowDefault && defaultAvatar) {
      choices.push(['default', defaultChoiceText ?? t('Use default avatar')]);
    }
    if (allowLetter) {
      choices.push(['letter_avatar', t('Use initials')]);
    }
    if (allowUpload) {
      choices.push(['upload', t('Upload an image')]);
    }
    if (allowGravatar) {
      choices.push(['gravatar', t('Use Gravatar')]);
    }

    return (
      <Panel>
        <PanelHeader>{title ?? t('Avatar')}</PanelHeader>
        <PanelBody>
          <AvatarForm>
            <AvatarGroup inline={isLetter || isDefault}>
              <RadioGroup
                style={{flex: 1}}
                choices={choices}
                value={avatarType}
                label={t('Avatar Type')}
                onChange={this.handleChange}
                disabled={disabled}
              />
              {isLetter && (
                <Avatar
                  gravatar={false}
                  style={{width: 90, height: 90}}
                  user={isUser ? (model as AvatarUser) : undefined}
                  organization={isOrganization ? (model as Organization) : undefined}
                  team={isTeam ? (model as Team) : undefined}
                  sentryApp={isSentryApp ? (model as SentryApp) : undefined}
                />
              )}
              {isDefault && defaultAvatar}
            </AvatarGroup>
            <AvatarUploadSection>
              {allowGravatar && avatarType === 'gravatar' && (
                <Well>
                  {t('Gravatars are managed through ')}
                  <ExternalLink href="http://gravatar.com">Gravatar.com</ExternalLink>
                </Well>
              )}
              {model.avatar && avatarType === 'upload' && (
                <AvatarCropper
                  {...this.props}
                  type={type!}
                  model={model}
                  savedDataUrl={savedDataUrl}
                  updateDataUrlState={dataState => this.setState(dataState)}
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

const AvatarGroup = styled('div')<{inline: boolean}>`
  display: flex;
  flex-direction: ${p => (p.inline ? 'row' : 'column')};
`;

const AvatarForm = styled('div')`
  line-height: 1.5em;
  padding: 1em 1.25em;
  margin: 1em 0.5em 0;
`;

const AvatarSubmit = styled('fieldset')`
  display: flex;
  justify-content: flex-end;
  margin-top: 1.25em;
`;

const AvatarUploadSection = styled('div')`
  margin-top: 1em;
`;

export default withApi(AvatarChooser);
