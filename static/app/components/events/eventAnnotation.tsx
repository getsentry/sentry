import styled from '@emotion/styled';

const EventAnnotation = styled('span')`
  font-size: ${p => p.theme.font.size.sm};
  border-left: 1px solid ${p => p.theme.tokens.border.secondary};
  padding-left: ${p => p.theme.space.md};
  color: ${p => p.theme.tokens.content.secondary};

  a {
    color: ${p => p.theme.tokens.content.secondary};

    &:hover {
      color: ${p => p.theme.tokens.content.secondary};
    }
  }
`;

export default EventAnnotation;
