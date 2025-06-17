import {useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {AvatarUploader} from 'sentry/components/avatarUploader';
import {OrganizationAvatar} from 'sentry/components/core/avatar/organizationAvatar';
import {SentryAppAvatar} from 'sentry/components/core/avatar/sentryAppAvatar';
import {UserAvatar} from 'sentry/components/core/avatar/userAvatar';
import {Button} from 'sentry/components/core/button';
import type {RadioOption} from 'sentry/components/forms/controls/radioGroup';
import RadioGroup from 'sentry/components/forms/controls/radioGroup';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Avatar} from 'sentry/types/core';
import type {SentryApp, SentryAppAvatarPhotoType} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import type {AvatarUser} from 'sentry/types/user';
import useApi from 'sentry/utils/useApi';

export interface Model {
  avatar?: Avatar;
}

type AvatarType = Avatar['avatarType'];

type AvatarChooserType =
  | 'user'
  | 'organization'
  | 'sentryAppColor'
  | 'sentryAppSimple'
  | 'docIntegration';

type DefaultChoice = {
  choiceText?: string;
  preview?: React.ReactNode;
};

interface AvatarChooserProps {
  endpoint: string;
  model: Model;
  supportedTypes: AvatarType[];
  defaultChoice?: DefaultChoice;
  disabled?: boolean;
  help?: React.ReactNode;
  onSave?: (model: Model) => void;
  savedDataUrl?: string;
  title?: string;
  type?: AvatarChooserType;
  uploadDomain?: string;
}

function AvatarChooser(props: AvatarChooserProps) {
  const {
    endpoint,
    model: propsModel,
    savedDataUrl,
    disabled,
    title,
    help,
    supportedTypes,
    type = 'user',
    onSave,
    defaultChoice = {},
    uploadDomain = '',
  } = props;

  const api = useApi();
  const [model, setModel] = useState(propsModel);
  const [newAvatar, setNewAvatar] = useState<string | null>(null);

  const hasError = false;

  const getModelFromResponse = (resp: any): Model => {
    const isSentryApp = type?.startsWith('sentryApp');
    // SentryApp endpoint returns all avatars, we need to return only the edited one
    if (!isSentryApp) {
      return resp;
    }
    const isColor = type === 'sentryAppColor';
    return {
      avatar: resp?.avatars?.find(({color}: any) => color === isColor) ?? undefined,
    };
  };

  const handleSaveSettings = () => {
    const avatarType = model?.avatar?.avatarType;
    const avatarPhoto = newAvatar?.split(',')[1];

    const data: {
      avatar_photo?: string;
      avatar_type?: string;
      color?: boolean;
      photoType?: SentryAppAvatarPhotoType;
    } = {avatar_type: avatarType};

    // If an image has been uploaded, then another option is selected, we should not submit the uploaded image
    if (avatarType === 'upload') {
      data.avatar_photo = avatarPhoto;
    }

    if (type?.startsWith('sentryApp')) {
      data.color = type === 'sentryAppColor';
      data.photoType = data.color ? 'logo' : 'icon';
    }

    api.request(endpoint, {
      method: 'PUT',
      data,
      success: resp => {
        const newModel = getModelFromResponse(resp);
        setModel(newModel);
        onSave?.(newModel);
        addSuccessMessage(t('Successfully saved avatar preferences'));
      },
      error: resp => {
        const avatarPhotoErrors = resp?.responseJSON?.avatar_photo || [];
        if (avatarPhotoErrors.length) {
          avatarPhotoErrors.map(addErrorMessage);
        } else {
          addErrorMessage(t('There was an error saving your preferences.'));
        }
      },
    });
  };

  if (hasError) {
    return <LoadingError />;
  }
  if (!model) {
    return <LoadingIndicator />;
  }
  const {preview, choiceText: defaultChoiceText} = defaultChoice || {};

  const avatarType = model.avatar?.avatarType ?? 'letter_avatar';
  const isLetter = avatarType === 'letter_avatar';
  const isDefault = !!preview && avatarType === 'default';

  const isUser = type === 'user';
  const isOrganization = type === 'organization';
  const isSentryApp = type?.startsWith('sentryApp');

  const gravatarLink = <ExternalLink href="https://gravatar.com" />;

  const options: Array<RadioOption<AvatarType>> = [
    ['default', defaultChoiceText ?? t('Use default avatar')],
    ['letter_avatar', t('Use initials')],
    ['upload', t('Upload an image')],
    [
      'gravatar',
      t('Use Gravatar'),
      tct('Manage your Gravatar on [gravatarLink:gravatar.com].', {gravatarLink}),
    ],
  ];

  const choices = options.filter(([key]) => supportedTypes.includes(key));

  const sharedAvatarProps = {
    gravatar: false,
    style: {width: 90, height: 90},
  };

  const avatar = isUser ? (
    <UserAvatar {...sharedAvatarProps} user={model as AvatarUser} />
  ) : isOrganization ? (
    <OrganizationAvatar {...sharedAvatarProps} organization={model as Organization} />
  ) : isSentryApp ? (
    <SentryAppAvatar {...sharedAvatarProps} sentryApp={model as SentryApp} />
  ) : null;

  return (
    <Panel>
      <PanelHeader>{title || t('Avatar')}</PanelHeader>
      <PanelBody>
        <AvatarForm>
          <AvatarGroup inline={isLetter || isDefault}>
            <RadioGroup
              style={{flex: 1}}
              choices={choices}
              value={avatarType}
              label={t('Avatar Type')}
              onChange={newType =>
                setModel(prevModel => ({
                  ...prevModel,
                  avatar: {
                    avatarUuid: prevModel.avatar?.avatarUuid ?? '',
                    avatarType: newType,
                  },
                }))
              }
              disabled={disabled}
            />
            {isLetter && avatar}
            {isDefault && preview}
          </AvatarGroup>
          <AvatarUploadSection>
            {model.avatar && avatarType === 'upload' && (
              <AvatarUploader
                {...props}
                type={type}
                model={model}
                savedDataUrl={savedDataUrl}
                uploadDomain={uploadDomain ?? ''}
                updateDataUrlState={({dataUrl: newDataUrl}) =>
                  setNewAvatar(newDataUrl ?? null)
                }
              />
            )}
            <AvatarSubmit className="form-actions">
              {help && <AvatarHelp>{help}</AvatarHelp>}
              <Button
                priority="primary"
                onClick={handleSaveSettings}
                disabled={disabled || (avatarType === 'upload' && !newAvatar)}
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

const AvatarHelp = styled('p')`
  margin-right: auto;
  color: ${p => p.theme.subText};
  font-size: 14px;
  width: 50%;
`;

const AvatarGroup = styled('div')<{inline: boolean}>`
  display: flex;
  flex-direction: ${p => (p.inline ? 'row' : 'column')};
`;

const AvatarForm = styled('div')`
  line-height: ${space(3)};
  padding: ${space(1.5)} ${space(2)};
  margin: ${space(1.5)} ${space(1)} ${space(0.5)};
`;

const AvatarSubmit = styled('fieldset')`
  display: flex;
  align-items: center;
  margin-top: ${space(4)};
  padding-top: ${space(1.5)};
`;

const AvatarUploadSection = styled('div')`
  margin-top: ${space(1.5)};
`;

export default AvatarChooser;
