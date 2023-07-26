import Access from 'sentry/components/acl/access';
import {t} from 'sentry/locale';
import {Organization, SentryApp} from 'sentry/types';

import ActionButtons from './actionButtons';

type Props = {
  app: SentryApp;
  onClickRemove: (app: SentryApp) => void;

  organization: Organization;
  onClickPublish?: () => void;
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
