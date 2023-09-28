import styled from '@emotion/styled';

import AvatarList from 'sentry/components/avatar/avatarList';
import {ListGroupItem} from 'sentry/components/listGroup';
import TextOverflow from 'sentry/components/textOverflow';
import {space} from 'sentry/styles/space';
import type {AvatarUser, CommitAuthor} from 'sentry/types';

import FileIcon from './fileIcon';

interface FileChangeProps {
  authors: CommitAuthor[];
  filename: string;
}

function FileChange({filename, authors}: FileChangeProps) {
  return (
    <FileItem>
      <Filename>
        <FileIconWrapper>
          <FileIcon fileName={filename} />
        </FileIconWrapper>
        <TextOverflow>{filename}</TextOverflow>
      </Filename>
      <AvatarList users={authors as AvatarUser[]} avatarSize={25} typeAvatars="authors" />
    </FileItem>
  );
}

const FileItem = styled(ListGroupItem)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${space(3)};

  border-radius: 0;
  border-left: none;
  border-right: none;
  border-top: none;
  :last-child {
    border: none;
    border-radius: 0;
  }
`;

const Filename = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: ${space(1)};
  align-items: center;
`;

const FileIconWrapper = styled('div')`
  display: flex;
  align-items: center;
  color: ${p => p.theme.gray200};
  border-radius: 3px;
`;

export default FileChange;
