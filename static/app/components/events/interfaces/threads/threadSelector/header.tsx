import {t} from 'sentry/locale';

import {Grid, GridCell} from './styles';

const Header = () => (
  <Grid>
    <GridCell />
    <GridCell>{t('Id')}</GridCell>
    <GridCell>{t('Name')}</GridCell>
    <GridCell>{t('Label')}</GridCell>
  </Grid>
);

export default Header;
