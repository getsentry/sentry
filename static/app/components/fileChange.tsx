import styled from '@emotion/styled';

import AvatarList from 'sentry/components/avatar/avatarList';
import FileIcon from 'sentry/components/fileIcon';
import {ListGroupItem} from 'sentry/components/listGroup';
import TextOverflow from 'sentry/components/textOverflow';
import {space} from 'sentry/styles/space';
import {AvatarUser, CommitAuthor} from 'sentry/types';

type Props = {
  authors: CommitAuthor[];
  filename: string;
  className?: string;
};

const FileChange = ({filename, authors, className}: Props) => (
  <FileItem className={className}>
    <Filename>
      <StyledFileIcon fileName={filename} />
      <TextOverflow>{filename}</TextOverflow>
    </Filename>
    <div>
      <AvatarList users={authors as AvatarUser[]} avatarSize={25} typeMembers="authors" />
    </div>
  </FileItem>
);

const FileItem = styled(ListGroupItem)`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const Filename = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  display: grid;
  gap: ${space(1)};
  margin-right: ${space(3)};
  align-items: center;
  grid-template-columns: max-content 1fr;
`;

const StyledFileIcon = styled(FileIcon)`
  color: ${p => p.theme.gray200};
  border-radius: 3px;
`;

export default FileChange;
