import React from 'react';

import {PanelHeader} from 'app/components/panels';
import {t} from 'app/locale';

import {
  LastEventColumn,
  Layout,
  CountColumn,
  VersionColumn,
  ProjectsColumn,
  StatsColumn,
} from './layout';

const ReleaseListHeader = () => (
  <PanelHeader>
    <Layout>
      <VersionColumn>{t('Version')}</VersionColumn>
      <ProjectsColumn>{t('Project')}</ProjectsColumn>
      <StatsColumn />
      <CountColumn>{t('New Issues')}</CountColumn>
      <LastEventColumn>{t('Last Event')}</LastEventColumn>
    </Layout>
  </PanelHeader>
);
export default ReleaseListHeader;
