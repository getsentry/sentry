import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import space from 'app/styles/space';
import {
  StyledLayout,
  StyledColumn,
  StyledCenterAlignedColumn,
  StyledRightAlignedColumn,
  StyledChartColumn,
} from 'app/views/health/list/commonLayout';
import ToolbarHeader from 'app/components/toolbarHeader';

const HealthTableHead: React.FC = () => {
  return (
    <StyledLayout>
      <StyledColumn />
      <StyledColumn>{t('Release')}</StyledColumn>
      <StyledCenterAlignedColumn>{t('Crash Free Users')}</StyledCenterAlignedColumn>
      <StyledChartColumn>
        <StyledChartToggler>
          <StyledToolbarHeader>{t('Graph:')}</StyledToolbarHeader>
          <StyledChartToggle active onClick={() => {}}>
            {t('24h')}
          </StyledChartToggle>

          <StyledChartToggle active={false} onClick={() => {}}>
            {t('14d')}
          </StyledChartToggle>
        </StyledChartToggler>
      </StyledChartColumn>
      <StyledCenterAlignedColumn>{t('Active Users')}</StyledCenterAlignedColumn>
      <StyledChartColumn>
        <StyledChartToggler>
          <StyledToolbarHeader>{t('Graph:')}</StyledToolbarHeader>
          <StyledChartToggle active onClick={() => {}}>
            {t('24h')}
          </StyledChartToggle>

          <StyledChartToggle active={false} onClick={() => {}}>
            {t('14d')}
          </StyledChartToggle>
        </StyledChartToggler>
      </StyledChartColumn>
      <StyledRightAlignedColumn>{t('Crashes')}</StyledRightAlignedColumn>
      <StyledRightAlignedColumn>{t('Errors')}</StyledRightAlignedColumn>
      <StyledRightAlignedColumn>{t('Adoption')}</StyledRightAlignedColumn>
    </StyledLayout>
  );
};

const StyledChartToggler = styled('div')`
  display: flex;
`;
const StyledToolbarHeader = styled(ToolbarHeader)`
  flex: 1;
  font-size: 13px;
`;
const StyledChartToggle = styled('a')<{active: boolean}>`
  font-size: 13px;
  padding-left: ${space(1)};
  font-weight: 400;

  &,
  &:hover,
  &:focus,
  &:active {
    color: ${p => (p.active ? p.theme.gray4 : p.theme.disabled)};
  }
`;

export default HealthTableHead;
