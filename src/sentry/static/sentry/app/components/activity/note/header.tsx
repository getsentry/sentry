import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import ActivityAuthor from 'app/components/activity/author';
import ConfigStore from 'app/stores/configStore';
import LinkWithConfirmation from 'app/components/links/linkWithConfirmation';
import {User} from 'app/types';
import {Theme} from 'app/utils/theme';
import Tooltip from 'app/components/tooltip';

import EditorTools from './editorTools';

type Props = {
  authorName: string;
  user: User;
  onEdit: () => void;
  onDelete: () => void;
};

const NoteHeader = ({authorName, user, onEdit, onDelete}: Props) => {
  const activeUser = ConfigStore.get('user');
  const canEdit = activeUser && (activeUser.isSuperuser || user.id === activeUser.id);

  return (
    <div>
      <ActivityAuthor>{authorName}</ActivityAuthor>
      {canEdit && (
        <EditorTools>
          <Tooltip
            title={t('You can edit this comment due to your superuser status')}
            disabled={!activeUser.isSuperuser}
          >
            <Edit onClick={onEdit}>{t('Edit')}</Edit>
          </Tooltip>
          <Tooltip
            title={t('You can delete this comment due to your superuser status')}
            disabled={!activeUser.isSuperuser}
          >
            <LinkWithConfirmation
              title={t('Remove')}
              message={t('Are you sure you wish to delete this comment?')}
              onConfirm={onDelete}
            >
              <Remove>{t('Remove')}</Remove>
            </LinkWithConfirmation>
          </Tooltip>
        </EditorTools>
      )}
    </div>
  );
};

const getActionStyle = (p: {theme: Theme}) => `
  padding: 0 7px;
  color: ${p.theme.gray400};
  font-weight: normal;
`;

const Edit = styled('a')`
  ${getActionStyle};
  margin-left: 7px;

  &:hover {
    color: ${p => p.theme.gray500};
  }
`;

const Remove = styled('span')`
  ${getActionStyle};
  border-left: 1px solid ${p => p.theme.border};

  &:hover {
    color: ${p => p.theme.error};
  }
`;

export default NoteHeader;
