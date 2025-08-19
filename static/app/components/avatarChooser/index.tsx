import {useCallback, useState} from 'react';
import styled from '@emotion/styled';
import {useMutation} from '@tanstack/react-query';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import type {BaseAvatarProps} from 'sentry/components/core/avatar/baseAvatar';
import {OrganizationAvatar} from 'sentry/components/core/avatar/organizationAvatar';
import {SentryAppAvatar} from 'sentry/components/core/avatar/sentryAppAvatar';
import {UserAvatar} from 'sentry/components/core/avatar/userAvatar';
import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {ExternalLink} from 'sentry/components/core/link';
import type {RadioOption} from 'sentry/components/forms/controls/radioGroup';
import RadioGroup from 'sentry/components/forms/controls/radioGroup';
import {Hovercard} from 'sentry/components/hovercard';
import Panel from 'sentry/components/panels/panel';
import PanelFooter from 'sentry/components/panels/panelFooter';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {IconImage, IconOpen, IconStar, IconUpload} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Avatar} from 'sentry/types/core';
import type {
  SentryApp,
  SentryAppAvatar as SentryAppAvatarType,
} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import type {AvatarUser} from 'sentry/types/user';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';

import {AiAvatarModal} from './aiAvatarModal';
import {AvatarCropper} from './avatarCropper';
import {useUploader} from './useUploader';

interface AvatarSaveData {
  ai_prompt?: string;
  avatar_photo?: string;
  avatar_type?: string;
  color?: boolean;
  photoType?: string;
}

interface SimpleAvatar {
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
  description?: React.ReactNode;
  label?: string;
};

interface AvatarChooserProps {
  endpoint: string;
  model: SimpleAvatar | SentryApp;
  supportedTypes: AvatarType[];
  defaultChoice?: DefaultChoice;
  disabled?: boolean;
  help?: React.ReactNode;
  onSave?: (model: SimpleAvatar) => void;
  title?: string;
  type?: AvatarChooserType;
}

// These values must be synced with the avatar endpoint in backend.
const MIN_DIMENSION = 256;
const MAX_DIMENSION = 1024;

// Helper function to get avatar from model
const getAvatarFromModel = (
  targetModel: SimpleAvatar | SentryApp,
  isSentryApp: boolean,
  type: AvatarChooserType
) => {
  if ('avatar' in targetModel) {
    return targetModel.avatar;
  }

  if (isSentryApp) {
    const sentryApp = targetModel as SentryApp;
    const isColor = type === 'sentryAppColor';
    return sentryApp.avatars?.find(appAvatar => appAvatar.color === isColor);
  }

  return undefined;
};

// XXX(epurkhiser): This component knows WAY too much about sentry apps and
// makes a lot of assumptions otherwise about how avatar are stored. We should
// refactor the interface and split this up more.

function AvatarChooser({
  endpoint,
  model: propsModel,
  disabled,
  title,
  help,
  supportedTypes,
  type = 'user',
  onSave,
  defaultChoice = {},
}: AvatarChooserProps) {
  const api = useApi();
  const [model, setModel] = useState(propsModel);

  const [cropperOpen, setCropperOpen] = useState(false);
  const [croppedAvatar, setCroppedAvatar] = useState<string | null>(null);

  const saveAvatarMutation = useMutation({
    mutationFn: (data: AvatarSaveData) =>
      api.requestPromise(endpoint, {method: 'PUT', data}),
    onSuccess: resp => {
      setModel(resp);
      onSave?.(resp);
      addSuccessMessage(t('Successfully saved avatar preferences'));
    },
    onError: (error: RequestError) => {
      const avatarPhotoErrors = error?.responseJSON?.avatar_photo;
      if (Array.isArray(avatarPhotoErrors) && avatarPhotoErrors.length) {
        avatarPhotoErrors.forEach(msg => addErrorMessage(msg));
      } else {
        addErrorMessage(t('There was an error saving your preferences.'));
      }
    },
  });

  const isSentryApp = ['sentryAppColor', 'sentryAppSimple'].includes(type);

  // Keep track of avatars by type to preserve them when switching
  const [avatarsByType, setAvatarsByType] = useState<Partial<Record<AvatarType, Avatar>>>(
    () => {
      // Initialize with any existing avatar from the model
      const initialAvatar = getAvatarFromModel(propsModel, isSentryApp, type);
      if (initialAvatar?.avatarType && initialAvatar?.avatarUrl) {
        return {
          [initialAvatar.avatarType]: initialAvatar,
        };
      }
      return {};
    }
  );

  const replaceAvatar = useCallback(
    (avatar: Avatar) => {
      // Store avatar by type for preservation when switching
      if (avatar.avatarType && avatar.avatarUrl) {
        setAvatarsByType(prev => ({
          ...prev,
          [avatar.avatarType]: avatar,
        }));
      }

      if (['user', 'organization', 'docIntegration'].includes(type)) {
        setModel(prevModel => ({...prevModel, avatar}));
        return;
      }

      if (isSentryApp) {
        setModel(prevModel => {
          const sentryApp = prevModel as SentryApp;
          const color = type === 'sentryAppColor';
          const avatarIndex = sentryApp.avatars?.findIndex(
            appAvatar => appAvatar.color === color
          );
          const avatars = [...(sentryApp.avatars ?? [])];

          const replacmentAvatar: SentryAppAvatarType = {
            ...avatar,
            color,
            photoType: color ? 'logo' : 'icon',
          };

          if (avatarIndex === undefined || avatarIndex === -1) {
            avatars.push(replacmentAvatar);
          } else {
            avatars[avatarIndex] = replacmentAvatar;
          }
          return {...sentryApp, avatars} as SimpleAvatar;
        });
        return;
      }

      throw new Error('Invalid avatar chooser type');
    },
    [type, isSentryApp]
  );

  const handleAvatarSave = useCallback(
    (entity: any) => {
      if (entity.avatar) {
        if (entity._croppedData) {
          setCroppedAvatar(entity._croppedData);
        }
        replaceAvatar({
          ...entity.avatar,
          avatarType: 'ai_generated' as const,
        });
      }
    },
    [replaceAvatar]
  );

  const getAvatar = (targetModel: SimpleAvatar | SentryApp) => {
    if ('avatar' in targetModel) {
      return targetModel.avatar;
    }

    if (isSentryApp) {
      const sentryApp = model as SentryApp;
      const isColor = type === 'sentryAppColor';
      return sentryApp.avatars?.find(appAvatar => appAvatar.color === isColor);
    }

    return undefined;
  };

  const resetToType = (avatarType: AvatarType) => {
    const storedAvatar = avatarsByType[avatarType];
    if (storedAvatar) {
      replaceAvatar(storedAvatar);
    } else {
      const propsAvatar = getAvatar(propsModel);
      replaceAvatar({
        ...propsAvatar,
        avatarUuid: propsAvatar?.avatarUuid ?? '',
        avatarType,
        avatarUrl: null,
      });
    }
  };

  const handleSaveAvatar = () => {
    const avatarType = getAvatar(model)?.avatarType;
    const base64Data = croppedAvatar?.split(',')[1];
    setCroppedAvatar(null);

    const data: AvatarSaveData = {avatar_type: avatarType};

    if (avatarType === 'ai_generated' && base64Data) {
      data.avatar_photo = base64Data;
      data.ai_prompt = 'cropped_ai_avatar';
    }

    if (avatarType === 'upload') {
      data.avatar_photo = base64Data;
    }

    if (type?.startsWith('sentryApp')) {
      data.color = type === 'sentryAppColor';
      data.photoType = data.color ? 'logo' : 'icon';
    }

    saveAvatarMutation.mutate(data);
  };

  const {fileInput, openUpload, objectUrl} = useUploader({
    onSelect: () => setCropperOpen(true),
    minImageSize: MIN_DIMENSION,
  });

  const avatarType =
    getAvatar(model)?.avatarType ?? (defaultChoice ? 'default' : 'letter_avatar');

  const {label: defaultChoiceText, description: defaultDescription} = defaultChoice || {};

  const options: Array<RadioOption<AvatarType>> = [
    ['default', defaultChoiceText ?? t('Use default avatar'), defaultDescription],
    ['letter_avatar', t('Use initials')],
    ['upload', t('Upload an image')],
    [
      'gravatar',
      t('Use Gravatar'),
      tct('Manage your Gravatar on [gravatarLink:gravatar.com].', {
        gravatarLink: <ExternalLink href="https://gravatar.com" />,
      }),
    ],
    [
      'ai_generated',
      t('Generate with AI'),
      t(
        'Use a custom prompt, predefined suggestions, or let us generate something fun for you'
      ),
    ],
  ];
  const choices = options.filter(([key]) => supportedTypes.includes(key));

  const uploadActions = (
    <AvatarActions>
      <Button
        aria-label={t('Replace image')}
        title={t('Replace image')}
        size="zero"
        borderless
        icon={<IconUpload />}
        onClick={openUpload}
      />
    </AvatarActions>
  );

  const gravatarActions = (
    <AvatarActions>
      <LinkButton
        external
        href="https://gravatar.com"
        size="zero"
        borderless
        icon={<IconOpen />}
        aria-label={t('Go to gravatar.com')}
        title={t('Visit gravatar.com to upload your Gravatar to be used on Sentry.')}
      />
    </AvatarActions>
  );

  const aiActions = (
    <AvatarActions>
      <Button
        aria-label={t('Open AI Generator')}
        title={t('Open AI Generator')}
        size="zero"
        borderless
        icon={<IconOpen />}
        onClick={() => {
          const currentEntity = model as AvatarUser | Organization;

          openModal(deps => (
            <AiAvatarModal
              {...deps}
              endpoint={endpoint}
              currentEntity={currentEntity}
              onSave={handleAvatarSave}
            />
          ));
        }}
      />
    </AvatarActions>
  );

  const emptyGravatar = (
    <BlankAvatar>
      <IconImage size="xl" />
    </BlankAvatar>
  );

  const emptyUploader = (
    <BlankUploader>
      <Button size="xs" icon={<IconUpload />} onClick={openUpload}>
        {t('Upload')}
      </Button>
    </BlankUploader>
  );

  const emptyAiGenerated = (
    <BlankAvatar>
      <IconStar size="xl" />
    </BlankAvatar>
  );

  const backupAvatars: Partial<Record<AvatarType, React.ReactNode>> = {
    gravatar: emptyGravatar,
    upload: emptyUploader,
    ai_generated: emptyAiGenerated,
  };

  const sharedAvatarProps: Partial<Omit<BaseAvatarProps, 'ref'>> = {
    type: avatarType,
    backupAvatar: backupAvatars[avatarType],
    size: 90,
  };

  const avatarPreview =
    type === 'user' ? (
      <UserAvatar {...sharedAvatarProps} user={model as AvatarUser} />
    ) : type === 'organization' ? (
      <OrganizationAvatar {...sharedAvatarProps} organization={model as Organization} />
    ) : isSentryApp ? (
      <SentryAppAvatar
        {...sharedAvatarProps}
        sentryApp={model as SentryApp}
        isColor={type === 'sentryAppColor'}
      />
    ) : null;

  const cropper = (
    <CropperContainer>
      <AvatarCropper
        minDimension={MIN_DIMENSION}
        maxDimension={MAX_DIMENSION}
        dataUrl={objectUrl ?? undefined}
        updateDataUrlState={dataUrl => {
          const avatar: Avatar = {
            avatarType: 'upload',
            avatarUuid: '',
            avatarUrl: dataUrl,
          };
          replaceAvatar(avatar);
          setCroppedAvatar(dataUrl ?? null);
        }}
      />
      <CropperActions>
        <Button
          size="xs"
          priority="danger"
          onClick={() => {
            resetToType('upload');
            setCropperOpen(false);
            setCroppedAvatar(null);
          }}
        >
          {t('Cancel')}
        </Button>
        <Button
          size="xs"
          priority="primary"
          onClick={() => {
            setCropperOpen(false);
            handleSaveAvatar();
          }}
        >
          {t('Looks good')}
        </Button>
      </CropperActions>
    </CropperContainer>
  );

  return (
    <Panel>
      <PanelHeader>{title ?? t('Avatar')}</PanelHeader>
      <AvatarChooserBody>
        {fileInput}
        <CropperHovercard
          skipWrapper
          position="right-end"
          forceVisible={cropperOpen}
          body={cropper}
        >
          <AvatarPreview>
            {avatarPreview}
            {avatarType === 'gravatar' && gravatarActions}
            {avatarType === 'upload' && !disabled && uploadActions}
            {avatarType === 'ai_generated' && !disabled && aiActions}
          </AvatarPreview>
        </CropperHovercard>
        <RadioGroup
          label={t('Avatar Type')}
          choices={choices}
          value={avatarType}
          onChange={newType => {
            resetToType(newType);
            setCropperOpen(false);
          }}
          disabled={disabled}
        />
      </AvatarChooserBody>
      <AvatarChooserFooter>
        {help && <AvatarHelp>{help}</AvatarHelp>}
        <Button
          priority="primary"
          onClick={handleSaveAvatar}
          disabled={disabled || saveAvatarMutation.isPending}
        >
          {saveAvatarMutation.isPending ? t('Saving...') : t('Save Avatar')}
        </Button>
      </AvatarChooserFooter>
    </Panel>
  );
}

const AvatarChooserFooter = styled(PanelFooter)`
  padding: ${space(2)};
`;

const AvatarPreview = styled('div')`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${space(1)};
  border-radius: ${p => p.theme.borderRadius};
  background-size: 20px 20px;
  background-position:
    0 0,
    0 10px,
    10px -10px,
    -10px 0px;
  background-color: ${p => p.theme.background};
  background-image:
    linear-gradient(45deg, ${p => p.theme.backgroundSecondary} 25%, rgba(0, 0, 0, 0) 25%),
    linear-gradient(
      -45deg,
      ${p => p.theme.backgroundSecondary} 25%,
      rgba(0, 0, 0, 0) 25%
    ),
    linear-gradient(45deg, rgba(0, 0, 0, 0) 75%, ${p => p.theme.backgroundSecondary} 75%),
    linear-gradient(-45deg, rgba(0, 0, 0, 0) 75%, ${p => p.theme.backgroundSecondary} 75%);
`;

const AvatarChooserBody = styled('div')`
  margin: ${space(2)};
  display: grid;
  grid-template-columns: max-content 1fr;
  align-items: center;
  gap: ${space(2)};
`;

const CropperHovercard = styled(Hovercard)`
  width: 300px;
`;

const CropperContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;

const CropperActions = styled('div')`
  display: flex;
  justify-content: flex-end;
  gap: ${space(1)};
`;

const AvatarHelp = styled('p')`
  margin-right: auto;
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.md};
  width: 50%;
`;

const BlankAvatar = styled('div')`
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${p => p.theme.gray200};
  background: ${p => p.theme.backgroundSecondary};
  height: 90px;
  width: 90px;
`;

const BlankUploader = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
`;

const AvatarActions = styled('div')`
  position: absolute;
  top: ${space(0.25)};
  right: ${space(0.25)};
  display: flex;
  background: ${p => p.theme.translucentSurface200};
  padding: ${space(0.25)};
  border-radius: 3px;
`;

export default AvatarChooser;
