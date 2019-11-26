import React from 'react';

import styled from 'react-emotion';

import {LightWeightOrganization, SentryApp} from 'app/types';

import Button from 'app/components/button';
import ConfirmDelete from 'app/components/confirmDelete';

import {t} from 'app/locale';
import space from 'app/styles/space';

type Props = {
  org: LightWeightOrganization;
  app: SentryApp;

  showDashboard: boolean;
  showPublish: boolean;
  showDelete: boolean;
  onPublish?: () => void;
  onDelete?: (app: SentryApp) => void;
  // If you want to disable the publish or delete buttons, pass in a reason to display to the user in a tooltip
  disablePublishReason?: string;
  disableDeleteReason?: string;
};

const ActionButtons = ({
  org,
  app,
  showDashboard,
  showPublish,
  showDelete,
  onPublish,
  onDelete,
  disablePublishReason,
  disableDeleteReason,
}: Props) => {
  const appDashboardButton = showDashboard ? (
    <StyledButton
      size="small"
      icon="icon-stats"
      to={`/settings/${org.slug}/developer-settings/${app.slug}/dashboard/`}
    >
      {t('Dashboard')}
    </StyledButton>
  ) : null;

  const publishRequestButton = showPublish ? (
    <StyledButton
      disabled={!!disablePublishReason}
      title={disablePublishReason}
      icon="icon-upgrade"
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
        icon="icon-trash"
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
          <StyledButton size="small" icon="icon-trash" label="Delete" />
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
  color: ${p => p.theme.gray2};
`;

export default ActionButtons;
