import styled from '@emotion/styled';

import space from 'app/styles/space';

const DateDivider = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${p => p.theme.gray600};
  margin: ${space(1.5)} 0;

  &:before,
  &:after {
    content: '';
    display: block;
    flex-grow: 1;
    height: 1px;
    background-color: ${p => p.theme.gray300};
  }

  &:before {
    margin-right: ${space(2)};
  }

  &:after {
    margin-left: ${space(2)};
  }
`;

export default DateDivider;
