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
} from 'app/views/releasesV2/list/commonLayout';

const ReleasesV2TableHead = () => {
  return (
    <Layout>
      <Column />
      <Column>{t('Release')}</Column>
      <CenterAlignedColumn>{t('Crash Free Users')}</CenterAlignedColumn>
      <ChartColumn>
        <ChartToggler>
          <ChartTogglerTitle>{t('Graph:')}</ChartTogglerTitle>
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
          <ChartTogglerTitle>{t('Graph:')}</ChartTogglerTitle>
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
const ChartTogglerTitle = styled('div')`
  flex: 1;
`;
const ChartToggle = styled('a')<{active: boolean}>`
  padding-left: ${space(1)};
  font-weight: 400;

  &,
  &:hover,
  &:focus,
  &:active {
    color: ${p => (p.active ? p.theme.gray4 : p.theme.disabled)};
  }
`;

export default ReleasesV2TableHead;
