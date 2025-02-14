import Access from 'sentry/components/acl/access';
import {t} from 'sentry/locale';
import type {
  SentryApp,
  SentryAppAvatar,
  SentryAppAvatarPhotoType,
  SentryAppSchemaElement,
} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';

import ActionButtons from './actionButtons';

type Props = {
  app: SentryApp;
  onClickRemove: (app: SentryApp) => void;

  organization: Organization;
  onClickPublish?: () => void;
};

const UI_COMPONENT_TYPES = ['stacktrace-link', 'issue-link'];

const hasInvalidStatus = (app: SentryApp): boolean => {
  return app.status !== 'unpublished';
};

const hasUploadedSentryAppPhoto = (
  avatars: SentryAppAvatar[] | undefined,
  photoType: SentryAppAvatarPhotoType
): boolean => {
  return avatars
    ? avatars.some(
        avatar => avatar.avatarType === 'upload' && avatar.photoType === photoType
      )
    : false;
};

const hasUIComponent = (elements: SentryAppSchemaElement[] | undefined): boolean => {
  return elements
    ? elements.some(element => UI_COMPONENT_TYPES.includes(element.type))
    : false;
};

function SentryApplicationRowButtons({
  organization,
  app,
  onClickRemove,
  onClickPublish,
}: Props) {
  const isInternal = app.status === 'internal';

  return (
    <Access access={['org:admin']}>
      {({hasAccess}) => {
        let disablePublishReason = '';
        let disableDeleteReason = '';

        // Publish & Delete buttons will always be disabled if the app is published
        if (app.status === 'published') {
          disablePublishReason = t('Published integrations cannot be re-published.');
          disableDeleteReason = t('Published integrations cannot be removed.');
        } else if (!hasAccess) {
          disablePublishReason = t(
            'Organization owner permissions are required for this action.'
          );
          disableDeleteReason = t(
            'Organization owner permissions are required for this action.'
          );
        } else if (hasInvalidStatus(app)) {
          disablePublishReason = t('Only unpublished integrations can be published');
        } else if (!hasUploadedSentryAppPhoto(app.avatars, 'logo')) {
          disablePublishReason = t('A logo is required to publish an integration');
        } else if (
          hasUIComponent(app.schema.elements) &&
          !hasUploadedSentryAppPhoto(app.avatars, 'icon')
        ) {
          disablePublishReason = t('Integrations with a UI component must have an icon');
        }

        return (
          <ActionButtons
            org={organization}
            app={app}
            showPublish={!isInternal}
            showDelete
            onPublish={onClickPublish}
            onDelete={onClickRemove}
            disablePublishReason={disablePublishReason}
            disableDeleteReason={disableDeleteReason}
          />
        );
      }}
    </Access>
  );
}

export default SentryApplicationRowButtons;
