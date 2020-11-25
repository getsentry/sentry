import React from 'react';
import styled from '@emotion/styled';

/**
 * Used in new inbox
 * Renders the project badge and short name
 */

type Props = {
  shortId: string;
  avatar?: React.ReactNode;
};

const ShortId = ({shortId, avatar}: Props) => (
  <UnhandledTagWrapper>
    <AvatarWrapper>{avatar}</AvatarWrapper>
    {shortId}
  </UnhandledTagWrapper>
);

export default ShortId;

const UnhandledTagWrapper = styled('div')`
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
`;

const AvatarWrapper = styled('div')`
  margin-right: 3px;
`;
