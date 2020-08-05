import React from 'react';
import styled from '@emotion/styled';

import LoadingContainer from 'app/components/loading/loadingContainer';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';

export const CardHeader = styled('div')`
  display: flex;
  padding: ${space(1.5)} ${space(2)};
`;

export const CardContent = styled('div')`
  flex-grow: 1;
  overflow: hidden;
  margin-right: ${space(1)};
`;

export const CardTitle = styled('div')`
  color: ${p => p.theme.textColor};
  ${overflowEllipsis};
`;

export const CardDetail = styled('div')`
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray500};
  line-height: 1.5;
  ${overflowEllipsis};
`;

export const CardBody = styled('div')`
  background: ${p => p.theme.gray200};
  max-height: 100px;
  height: 100%;
  overflow: hidden;
`;

export const CardFooter = styled('div')`
  display: flex;
  font-size: ${p => p.theme.fontSizeSmall};
  justify-content: space-between;
  align-items: center;
  padding: ${space(1)} ${space(2)};
`;

export const GraphContainer = styled(props => (
  <LoadingContainer {...props} maskBackgroundColor="transparent" />
))`
  height: 100px;

  display: flex;
  justify-content: center;
  align-items: center;
`;

export const DateSelected = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  display: grid;
  grid-column-gap: ${space(1)};
  ${overflowEllipsis};
  color: ${p => p.theme.gray700};
`;
