import styled from '@emotion/styled';

export const ProfilingDetailsFrameTabs = styled('ul')`
  display: flex;
  list-style-type: none;
  padding: 0 ${p => p.theme.space.md};
  margin: 0;
  border-top: 1px solid ${prop => prop.theme.tokens.border.primary};
  background-color: ${props => props.theme.tokens.background.secondary};
  user-select: none;
  grid-area: tabs;
`;

export const ProfilingDetailsListItem = styled('li')<{
  margin?: 'none';
  size?: 'sm';
}>`
  height: 100%;
  display: flex;
  align-items: center;
  font-size: ${p => p.theme.font.size.sm};
  margin-right: ${p => (p.margin === 'none' ? 0 : p.theme.space.md)};

  button {
    height: 100%;
    border: none;
    border-top: 2px solid transparent;
    border-bottom: 2px solid transparent;
    border-radius: 0;
    font-weight: ${p => p.theme.font.weight.sans.regular};
    margin: 0;

    color: ${p => p.theme.tokens.content.primary};

    display: inline-block;

    &::after {
      display: block;
      content: attr(data-title);
      font-weight: ${p => p.theme.font.weight.sans.medium};
      height: 1px;
      color: transparent;
      overflow: hidden;
      visibility: hidden;
      white-space: nowrap;
    }

    &:hover {
      color: ${p => p.theme.tokens.content.primary};
    }
  }

  &.active button {
    font-weight: ${p => p.theme.font.weight.sans.medium};
    border-bottom: 2px solid ${prop => prop.theme.tokens.border.accent};
  }
`;
