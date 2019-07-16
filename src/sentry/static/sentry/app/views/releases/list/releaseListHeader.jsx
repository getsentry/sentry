import React from 'react';

import {PanelHeader} from 'app/components/panels';
import {t} from 'app/locale';

import {LastEventColumn, Layout, CountColumn, VersionColumn, StatsColumn} from './layout';

const ReleaseListHeader = () => {
  return (
    <PanelHeader>
      <Layout>
        <VersionColumn>{t('Version')}</VersionColumn>
        <StatsColumn />
        <CountColumn>{t('New Issues')}</CountColumn>
        <LastEventColumn>{t('Last Event')}</LastEventColumn>
      </Layout>
    </PanelHeader>
  );
};
export default ReleaseListHeader;
