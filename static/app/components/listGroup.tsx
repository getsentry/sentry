import styled from '@emotion/styled';

type ListGroupItemProps = {
  centered?: boolean;
};

const ListGroupItem = styled('li')<ListGroupItemProps>`
  position: relative;
  display: block;
  min-height: 36px;
  border: 1px solid ${p => p.theme.tokens.border.primary};

  padding: ${p => p.theme.space.xs} ${p => p.theme.space.lg};

  margin-bottom: -1px;
  ${p => (p.centered ? 'text-align: center;' : '')}

  &:first-child {
    border-top-left-radius: ${p => p.theme.radius.md};
    border-top-right-radius: ${p => p.theme.radius.md};
  }
  &:last-child {
    border-bottom-left-radius: ${p => p.theme.radius.md};
    border-bottom-right-radius: ${p => p.theme.radius.md};
  }
`;

export {ListGroupItem};
