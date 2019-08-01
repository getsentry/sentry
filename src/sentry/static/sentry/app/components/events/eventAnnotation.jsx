import styled from 'react-emotion';

import space from 'app/styles/space';

const EventAnnotation = styled('span')`
  font-size: ${p => p.theme.fontSizeSmall};
  border-left: 1px solid ${p => p.theme.borderLight};
  padding-left: ${space(1)};
  color: ${p => p.theme.gray2};

  a {
    color: ${p => p.theme.gray2};

    &:hover {
      color: ${p => p.theme.gray3};
    }
  }
`;

export default EventAnnotation;
