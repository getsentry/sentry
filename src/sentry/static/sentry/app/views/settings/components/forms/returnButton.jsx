import styled from '@emotion/styled';

import {t} from 'app/locale';
import {IconReturn} from 'app/icons/iconReturn';
import Tooltip from 'app/components/tooltip';

const SubmitButton = styled('div')`
  background: transparent;
  box-shadow: none;
  border: 1px solid transparent;
  border-radius: ${p => p.theme.borderRadius};
  transition: 0.2s all;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 1.4em;
  width: 1.4em;
`;

const ClickTargetStyled = styled('div')`
  height: 100%;
  width: 25%;
  max-width: 2.5em;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;

  &:hover ${SubmitButton} {
    background: #fff;
    box-shadow: ${p => p.theme.dropShadowLight};
    border: 1px solid ${p => p.theme.borderLight};
  }
`;

const returnButton = props => (
  <ClickTargetStyled {...props}>
    <Tooltip title={t('Save')}>
      <SubmitButton>
        <IconReturn />
      </SubmitButton>
    </Tooltip>
  </ClickTargetStyled>
);

export default returnButton;
