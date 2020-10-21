import styled from '@emotion/styled';

import {LightWeightOrganization, SentryApp} from 'app/types';
import Button from 'app/components/button';
import {IconDelete, IconStats, IconUpgrade} from 'app/icons';
import ConfirmDelete from 'app/components/confirmDelete';
import {t} from 'app/locale';
import space from 'app/styles/space';

type Props = {
  org: LightWeightOrganization;
  app: SentryApp;

  showPublish: boolean;
  showDelete: boolean;
  onPublish?: () => void;
  onDelete: (app: SentryApp) => void;
  // If you want to disable the publish or delete buttons, pass in a reason to display to the user in a tooltip
  disablePublishReason?: string;
  disableDeleteReason?: string;
};

const ActionButtons = ({
  org,
  app,
  showPublish,
  showDelete,
  onPublish,
  onDelete,
  disablePublishReason,
  disableDeleteReason,
}: Props) => {
  const appDashboardButton = (
    <StyledButton
      size="small"
      icon={<IconStats />}
      to={`/settings/${org.slug}/developer-settings/${app.slug}/dashboard/`}
    >
      {t('Dashboard')}
    </StyledButton>
  );

  const publishRequestButton = showPublish ? (
    <StyledButton
      disabled={!!disablePublishReason}
      title={disablePublishReason}
      icon={<IconUpgrade />}
      size="small"
      onClick={onPublish}
    >
      {t('Publish')}
    </StyledButton>
  ) : null;

  const deleteConfirmMessage = t(
    `Deleting ${app.slug} will also delete any and all of its installations. \
         This is a permanent action. Do you wish to continue?`
  );
  const deleteButton = showDelete ? (
    disableDeleteReason ? (
      <StyledButton
        disabled
        title={disableDeleteReason}
        size="small"
        icon={<IconDelete />}
        label="Delete"
      />
    ) : (
      onDelete && (
        <ConfirmDelete
          message={deleteConfirmMessage}
          confirmInput={app.slug}
          priority="danger"
          onConfirm={() => onDelete(app)}
        >
          <StyledButton size="small" icon={<IconDelete />} label="Delete" />
        </ConfirmDelete>
      )
    )
  ) : null;

  return (
    <ButtonHolder>
      {appDashboardButton}
      {publishRequestButton}
      {deleteButton}
    </ButtonHolder>
  );
};

const ButtonHolder = styled('div')`
  flex-direction: row;
  display: flex;
  & > * {
    margin-left: ${space(0.5)};
  }
`;

const StyledButton = styled(Button)`
  color: ${p => p.theme.gray500};
`;

export default ActionButtons;
