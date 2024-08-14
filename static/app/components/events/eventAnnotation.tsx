import styled from '@emotion/styled';

const EventAnnotation = styled('span')`
  font-size: ${p => p.theme.fontSizeSmall};
  border-left: 1px solid ${p => p.theme.innerBorder};
  padding-left: ${p => p.theme.space(1)};
  color: ${p => p.theme.gray300};

  a {
    color: ${p => p.theme.gray300};

    &:hover {
      color: ${p => p.theme.subText};
    }
  }
`;

export default EventAnnotation;
