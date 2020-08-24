import styled from '@emotion/styled';

import space from 'app/styles/space';

const EventAnnotation = styled('span')`
  font-size: ${p => p.theme.fontSizeSmall};
  border-left: 1px solid ${p => p.theme.border};
  padding-left: ${space(1)};
  color: ${p => p.theme.gray500};

  a {
    color: ${p => p.theme.gray500};

    &:hover {
      color: ${p => p.theme.gray600};
    }
  }
`;

export default EventAnnotation;
