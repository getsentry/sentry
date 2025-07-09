import ConfirmDelete from 'sentry/components/confirmDelete';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {IconDelete, IconStats, IconUpgrade} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {SentryApp} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';

type Props = {
  app: SentryApp;
  onDelete: (app: SentryApp) => void;

  org: Organization;
  showDelete: boolean;
  showPublish: boolean;
  disableDeleteReason?: string;
  // If you want to disable the publish or delete buttons, pass in a reason to display to the user in a tooltip
  disablePublishReason?: string;
  onPublish?: () => void;
};

function ActionButtons({
  org,
  app,
  showPublish,
  showDelete,
  onPublish,
  onDelete,
  disablePublishReason,
  disableDeleteReason,
}: Props) {
  const appDashboardButton = (
    <LinkButton
      size="sm" redesign
      icon={<IconStats redesign />}
      to={`/settings/${org.slug}/developer-settings/${app.slug}/dashboard/`}
    >
      {t('Dashboard')}
    </LinkButton>
  );

  const publishRequestButton = showPublish ? (
    <Button
      disabled={!!disablePublishReason} redesign
      title={disablePublishReason}
      icon={<IconUpgrade redesign />}
      size="sm"
      onClick={onPublish}
    >
      {t('Publish')}
    </Button>
  ) : null;

  const deleteConfirmMessage = t(
    `Deleting %s will also delete any and all of its installations. This is a permanent action. Do you wish to continue?`,
    app.slug
  );
  const deleteButton = showDelete ? (
    disableDeleteReason ? (
      <Button
        disabled redesign
        title={disableDeleteReason}
        size="sm"
        icon={<IconDelete redesign />}
        aria-label={t('Delete')}
      />
    ) : (
      onDelete && (
        <ConfirmDelete
          message={deleteConfirmMessage}
          confirmInput={app.slug}
          priority="danger"
          onConfirm={() => onDelete(app)}
        >
          <Button size="sm" redesign icon={<IconDelete redesign />} aria-label={t('Delete')} />
        </ConfirmDelete>
      )
    )
  ) : null;

  return (
    <ButtonBar gap={1}>
      {appDashboardButton}
      {publishRequestButton}
      {deleteButton}
    </ButtonBar>
  );
}

export default ActionButtons;
