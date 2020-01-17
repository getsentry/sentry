import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import space from 'app/styles/space';
import {
  Layout,
  Column,
  CenterAlignedColumn,
  RightAlignedColumn,
  ChartColumn,
} from 'app/views/health/list/commonLayout';
import ToolbarHeader from 'app/components/toolbarHeader';

const HealthTableHead: React.FC = () => {
  return (
    <Layout>
      <Column />
      <Column>{t('Release')}</Column>
      <CenterAlignedColumn>{t('Crash Free Users')}</CenterAlignedColumn>
      <ChartColumn>
        <ChartToggler>
          <StyledToolbarHeader>{t('Graph:')}</StyledToolbarHeader>
          <ChartToggle active onClick={() => {}}>
            {t('24h')}
          </ChartToggle>

          <ChartToggle active={false} onClick={() => {}}>
            {t('14d')}
          </ChartToggle>
        </ChartToggler>
      </ChartColumn>
      <CenterAlignedColumn>{t('Active Users')}</CenterAlignedColumn>
      <ChartColumn>
        <ChartToggler>
          <StyledToolbarHeader>{t('Graph:')}</StyledToolbarHeader>
          <ChartToggle active onClick={() => {}}>
            {t('24h')}
          </ChartToggle>

          <ChartToggle active={false} onClick={() => {}}>
            {t('14d')}
          </ChartToggle>
        </ChartToggler>
      </ChartColumn>
      <RightAlignedColumn>{t('Crashes')}</RightAlignedColumn>
      <RightAlignedColumn>{t('Errors')}</RightAlignedColumn>
      <RightAlignedColumn>{t('Adoption')}</RightAlignedColumn>
    </Layout>
  );
};

const ChartToggler = styled('div')`
  display: flex;
`;
const StyledToolbarHeader = styled(ToolbarHeader)`
  flex: 1;
  font-size: 13px;
`;
const ChartToggle = styled('a')<{active: boolean}>`
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
