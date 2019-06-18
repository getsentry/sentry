import React from 'react';

import {PanelHeader} from 'app/components/panels';
import {t} from 'app/locale';

import {LastEventColumn, Layout, CountColumn, VersionColumn, StatsColumn} from './layout';

export default class ReleaseListHeader extends React.Component {
  render() {
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
  }
}
