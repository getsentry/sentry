/**
 * Activity component on Incident Details view
 * Allows user to leave a comment on an incident as well as
 * fetch and render existing activity items.
 */
import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';

const DateDivider = styled(function DateDivider({children, ...props}) {
  return (
    <div {...props}>
      <hr />
      <TitleWrapper>
        <Title>{children}</Title>
      </TitleWrapper>
    </div>
  );
})`
  position: relative;
  font-size: ${p => p.theme.fontSizeMedium};
`;

const Title = styled('span')`
  background-color: ${p => p.theme.white};
  padding: 0 ${space(2)};
`;

const TitleWrapper = styled('span')`
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;

  display: flex;
  align-items: center;
  justify-content: center;
  color: ${p => p.theme.gray3};
`;

export default DateDivider;
