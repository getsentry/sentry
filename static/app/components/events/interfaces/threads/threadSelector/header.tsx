import styled from '@emotion/styled';

import {t} from 'sentry/locale';

import {Grid, GridCell} from './styles';

type Props = {
  hasThreadStates: boolean;
};

function Header({hasThreadStates}: Props) {
  return (
    <StyledGrid hasThreadStates={hasThreadStates}>
      <GridCell />
      <GridCell>{t('Id')}</GridCell>
      <GridCell>{t('Name')}</GridCell>
      <GridCell>{t('Label')}</GridCell>
      {hasThreadStates && <GridCell>{t('State')}</GridCell>}
    </StyledGrid>
  );
}

export default Header;

const StyledGrid = styled(Grid)`
  padding-left: 40px;
  padding-right: 16px;
  color: ${p => p.theme.subText};
  font-weight: ${p => p.theme.fontWeightBold};
  border-bottom: 1px solid ${p => p.theme.border};
  margin-bottom: 2px;
`;
