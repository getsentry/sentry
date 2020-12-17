import React from 'react';
import styled from '@emotion/styled';
import PropTypes from 'prop-types';

import AvatarList from 'app/components/avatar/avatarList';
import FileIcon from 'app/components/fileIcon';
import {ListGroupItem} from 'app/components/listGroup';
import TextOverflow from 'app/components/textOverflow';
import space from 'app/styles/space';
import {AvatarUser, CommitAuthor} from 'app/types';

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
  color: ${p => p.theme.gray200};
  border-radius: 3px;
`;

export default FileChange;
