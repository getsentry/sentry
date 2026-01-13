import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

const EventAnnotation = styled('span')`
  font-size: ${p => p.theme.fontSize.sm};
  border-left: 1px solid ${p => p.theme.tokens.border.secondary};
  padding-left: ${space(1)};
  color: ${p => p.theme.tokens.content.secondary};

  a {
    color: ${p => p.theme.tokens.content.secondary};

    &:hover {
      color: ${p => p.theme.tokens.content.secondary};
    }
  }
`;

export default EventAnnotation;
