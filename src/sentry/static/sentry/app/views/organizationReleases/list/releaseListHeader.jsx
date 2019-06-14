import React from 'react';

import {PanelHeader} from 'app/components/panels';
import {t} from 'app/locale';

import {LastEvent, Layout, NewCount, ReleaseName, Stats} from './layout';

export default class ReleaseListHeader extends React.Component {
  render() {
    return (
      <PanelHeader>
        <Layout>
          <ReleaseName>{t('Version')}</ReleaseName>
          <Stats />
          <NewCount>{t('New Issues')}</NewCount>
          <LastEvent>{t('Last Event')}</LastEvent>
        </Layout>
      </PanelHeader>
    );
  }
}
