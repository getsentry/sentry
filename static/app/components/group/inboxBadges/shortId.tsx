import styled from '@emotion/styled';

/**
 * Used in new inbox
 * Renders the project badge and short name
 */

type Props = {
  shortId: string;
  avatar?: React.ReactNode;
  className?: string;
};

export function ShortId({shortId, avatar, className}: Props) {
  return (
    <Wrapper className={className}>
      <AvatarWrapper>{avatar}</AvatarWrapper>
      <IdWrapper>{shortId}</IdWrapper>
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  display: flex;
  align-items: center;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: ${p => p.theme.font.size.xs};
`;
const AvatarWrapper = styled('div')`
  margin-right: 3px;
  flex-shrink: 0;
`;

const IdWrapper = styled('div')`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;
