import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import space from 'app/styles/space';

const ReleasesV2TableHead = () => {
  return {
    /*<Layout>
      <Column>{t('Release')}</Column>
      <Column />

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
    </Layout>*/
  };
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
