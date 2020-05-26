import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import space from 'app/styles/space';

import {Grid, GridCell} from './styles';

const ListHeader = () => (
  <Grid>
    <StyledGridCell>{t('Type')}</StyledGridCell>
    <StyledGridCellCategory>{t('Category')}</StyledGridCellCategory>
    <StyledGridCell>{t('Description')}</StyledGridCell>
    <StyledGridCell>{t('Level')}</StyledGridCell>
    <StyledGridCell>{t('Time')}</StyledGridCell>
  </Grid>
);

export {ListHeader};

const StyledGridCell = styled(GridCell)`
  border-bottom: 1px solid ${p => p.theme.borderDark};
  margin: 1px 0 0;
  background: ${p => p.theme.offWhite};
  color: ${p => p.theme.gray3};
  font-weight: 600;
  text-transform: uppercase;
  line-height: 1;
  font-size: ${p => p.theme.fontSizeExtraSmall};

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    padding: ${space(2)} ${space(2)};
    font-size: ${p => p.theme.fontSizeSmall};
  }
`;

const StyledGridCellCategory = styled(StyledGridCell)`
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    padding-left: ${space(1)};
  }
`;
