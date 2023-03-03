import {t} from 'sentry/locale';

import {Grid, GridCell} from './styles';

type Props = {
  hasThreadStates: boolean;
};

const Header = ({hasThreadStates}: Props) => (
  <Grid hasThreadStates={hasThreadStates}>
    <GridCell />
    <GridCell>{t('Id')}</GridCell>
    <GridCell>{t('Name')}</GridCell>
    <GridCell>{t('Label')}</GridCell>
    {hasThreadStates && <GridCell>{t('State')}</GridCell>}
  </Grid>
);

export default Header;
