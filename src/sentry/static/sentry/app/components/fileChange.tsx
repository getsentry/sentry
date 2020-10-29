import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import {ListGroupItem} from 'app/components/listGroup';
import space from 'app/styles/space';
import {CommitAuthor, AvatarUser} from 'app/types';
import AvatarList from 'app/components/avatar/avatarList';
import FileIcon from 'app/components/fileIcon';
import TextOverflow from 'app/components/textOverflow';

type Props = {
  filename: string;
  authors: CommitAuthor[];
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

FileChange.propTypes = {
  filename: PropTypes.string.isRequired,
  authors: PropTypes.array.isRequired,
};

const FileItem = styled(ListGroupItem)`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const Filename = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  display: grid;
  grid-gap: ${space(1)};
  margin-right: ${space(3)};
  align-items: center;
  grid-template-columns: max-content 1fr;
`;

const StyledFileIcon = styled(FileIcon)`
  color: ${p => p.theme.gray400};
  border-radius: 3px;
`;

export default FileChange;
