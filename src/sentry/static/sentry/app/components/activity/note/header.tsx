import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import ActivityAuthor from 'app/components/activity/author';
import ConfigStore from 'app/stores/configStore';
import LinkWithConfirmation from 'app/components/links/linkWithConfirmation';
import {User} from 'app/types';
import {Theme} from 'app/utils/theme';

import EditorTools from './editorTools';

type Props = {
  authorName: string;
  user: User;
  onEdit: () => void;
  onDelete: () => void;
};

function canEdit(editingUser: User) {
  const user = ConfigStore.get('user');
  return user && (user.isSuperuser || user.id === editingUser.id);
}

const NoteHeader = ({authorName, user, onEdit, onDelete}: Props) => (
  <div>
    <ActivityAuthor>{authorName}</ActivityAuthor>
    {canEdit(user) && (
      <EditorTools>
        <Edit onClick={onEdit}>{t('Edit')}</Edit>
        <LinkWithConfirmation
          title={t('Remove')}
          message={t('Are you sure you wish to delete this comment?')}
          onConfirm={onDelete}
        >
          <Remove>{t('Remove')}</Remove>
        </LinkWithConfirmation>
      </EditorTools>
    )}
  </div>
);

const getActionStyle = (p: {theme: Theme}) => `
  padding: 0 7px;
  color: ${p.theme.gray1};
  font-weight: normal;
`;

const Edit = styled('a')`
  ${getActionStyle};
  margin-left: 7px;

  &:hover {
    color: ${p => p.theme.gray2};
  }
`;

const Remove = styled('span')`
  ${getActionStyle};
  border-left: 1px solid ${p => p.theme.borderLight};

  &:hover {
    color: ${p => p.theme.error};
  }
`;

export default NoteHeader;
