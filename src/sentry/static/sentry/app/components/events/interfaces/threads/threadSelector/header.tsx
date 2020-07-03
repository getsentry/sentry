import React from 'react';

import {t} from 'app/locale';

import {Grid, GridCell} from './styles';

const Header = () => (
  <Grid>
    <GridCell>{t('Id')}</GridCell>
    <GridCell>{t('Name')}</GridCell>
    <GridCell>{t('Label')}</GridCell>
    <GridCell>{t('Filename')}</GridCell>
    <GridCell>{t('Status')}</GridCell>
  </Grid>
);

export default Header;
