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
  <Wrapper>
    <AvatarWrapper>{avatar}</AvatarWrapper>
    <IdWrapper>{shortId}</IdWrapper>
  </Wrapper>
);

export default ShortId;

const Wrapper = styled('div')`
  display: flex;
  align-items: center;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: ${p => p.theme.fontSizeExtraSmall};
`;
const AvatarWrapper = styled('div')`
  margin-right: 3px;
  flex-shrink: 0;
`;

const IdWrapper = styled('div')`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 1px;
`;
