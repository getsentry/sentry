import styled from '@emotion/styled';
import {useMutation} from '@tanstack/react-query';

import {SentryAppAvatar} from '@sentry/scraps/avatar';
import {Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {useModal} from '@sentry/scraps/modal';
import {Text} from '@sentry/scraps/text';

import {
  addErrorMessage,
  addMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {useUploader} from 'sentry/components/avatarChooser/useUploader';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconCheckmark} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Avatar} from 'sentry/types/core';
import type {SentryApp, SentryAppAvatarPhotoType} from 'sentry/types/integrations';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';

import {AvatarCropModal} from './avatarCropModal';

export const SENTRY_APP_AVATAR_STYLES = {
  logo: {
    title: t('Logo'),
    label: t('Default logo'),
    description: t('The default icon for integrations'),
    help: t('Image must be between 256px by 256px and 1024px by 1024px.'),
  },
  icon: {
    title: t('Small Icon'),
    label: t('Default small icon'),
    description: tct('This is a silhouette icon used only for [uiDocs:UI Components]', {
      uiDocs: (
        <ExternalLink href="https://docs.sentry.io/product/integrations/integration-platform/ui-components/" />
      ),
    }),
    help: t(
      'Image must be between 256px by 256px and 1024px by 1024px, and may only use black and transparent pixels.'
    ),
  },
} satisfies Record<SentryAppAvatarPhotoType, unknown>;

// These values must be synced with the avatar endpoint in backend.
const MIN_DIMENSION = 256;
const MAX_DIMENSION = 1024;

interface SentryAppAvatarFieldProps {
  app: SentryApp;
  isInternal: boolean;
  onSave: (app: SentryApp) => void;
  photoType: SentryAppAvatarPhotoType;
}

/**
 * A settings field row that previews one of a sentry app's two avatars (logo
 * or small icon) and saves a new choice immediately on selection.
 */
export function SentryAppAvatarField({
  app,
  isInternal,
  onSave,
  photoType,
}: SentryAppAvatarFieldProps) {
  const {openModal} = useModal();
  const style = SENTRY_APP_AVATAR_STYLES[photoType];
  const isColor = photoType === 'logo';

  const avatarType =
    app.avatars?.find(appAvatar => appAvatar.color === isColor)?.avatarType ?? 'default';

  const saveMutation = useMutation({
    mutationFn: (data: {
      avatar_type: Avatar['avatarType'];
      color: boolean;
      photoType: SentryAppAvatarPhotoType;
      avatar_photo?: string;
    }) =>
      fetchMutation<SentryApp>({
        url: `/sentry-apps/${app.slug}/avatar/`,
        method: 'PUT',
        data,
      }),
  });

  const saveAvatar = async (newType: Avatar['avatarType'], photoData?: string) => {
    const previousType = avatarType;

    try {
      const updated = await saveMutation.mutateAsync({
        avatar_type: newType,
        color: isColor,
        photoType,
        ...(newType === 'upload' && photoData !== undefined
          ? {avatar_photo: photoData}
          : {}),
      });
      onSave(updated);

      const savedMessage = tct('[label] updated', {label: style.title});

      // A change away from the previous source can be undone by re-saving it
      // (uploaded files are retained server-side). Overwriting an upload with
      // a new upload cannot.
      if (previousType === newType) {
        addSuccessMessage(savedMessage);
      } else {
        addMessage(savedMessage, 'undo', {undo: () => saveAvatar(previousType)});
      }
    } catch (error) {
      const photoField =
        error instanceof RequestError ? error.responseJSON?.avatar_photo : undefined;
      const photoErrors = Array.isArray(photoField)
        ? photoField.filter(message => typeof message === 'string')
        : [];

      if (photoErrors.length) {
        photoErrors.forEach(message => addErrorMessage(message));
      } else {
        addErrorMessage(t('There was an error saving your preferences.'));
      }
    }
  };

  const {fileInput, openUpload} = useUploader({
    minImageSize: MIN_DIMENSION,
    onSelect: url =>
      openModal(deps => (
        <AvatarCropModal
          {...deps}
          dataUrl={url}
          minDimension={MIN_DIMENSION}
          maxDimension={MAX_DIMENSION}
          onCrop={croppedUrl => saveAvatar('upload', croppedUrl.split(',')[1])}
        />
      )),
  });

  const currentMark = (key: Avatar['avatarType']) =>
    avatarType === key ? <IconCheckmark size="xs" /> : undefined;

  const menuItems: MenuItemProps[] = [
    {
      key: 'default',
      label: style.label,
      details: style.description,
      trailingItems: currentMark('default'),
      onAction: () => saveAvatar('default'),
    },
    {
      key: 'upload',
      label: t('Upload an image…'),
      trailingItems: currentMark('upload'),
      onAction: () => openUpload(),
    },
  ];

  const help = isInternal ? style.help : `${style.help} ${t('Required for publishing.')}`;

  return (
    <Flex direction="row" gap="xl" align="center" justify="between" flexGrow={1}>
      <Stack width="50%" gap="xs">
        <Text>{style.title}</Text>
        <Text size="sm" variant="muted">
          {help}
        </Text>
      </Stack>
      <Flex align="center" justify="end" gap="lg" flexGrow={1}>
        {fileInput}
        <AvatarPreview>
          <SentryAppAvatar size={48} sentryApp={app} isColor={isColor} />
        </AvatarPreview>
        <DropdownMenu
          items={menuItems}
          triggerLabel={t('Change')}
          triggerProps={{size: 'sm'}}
        />
      </Flex>
    </Flex>
  );
}

const AvatarPreview = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${p => p.theme.space.xs};
  border-radius: ${p => p.theme.radius.md};
  background-size: 12px 12px;
  background-position:
    0 0,
    0 6px,
    6px -6px,
    -6px 0px;
  background-color: ${p => p.theme.tokens.background.primary};
  background-image:
    linear-gradient(
      45deg,
      ${p => p.theme.tokens.background.secondary} 25%,
      rgba(0, 0, 0, 0) 25%
    ),
    linear-gradient(
      -45deg,
      ${p => p.theme.tokens.background.secondary} 25%,
      rgba(0, 0, 0, 0) 25%
    ),
    linear-gradient(
      45deg,
      rgba(0, 0, 0, 0) 75%,
      ${p => p.theme.tokens.background.secondary} 75%
    ),
    linear-gradient(
      -45deg,
      rgba(0, 0, 0, 0) 75%,
      ${p => p.theme.tokens.background.secondary} 75%
    );
`;
