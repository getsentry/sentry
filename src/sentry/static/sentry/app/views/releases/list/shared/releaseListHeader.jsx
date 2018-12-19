import React from 'react';
import {Box} from 'grid-emotion';
import {PanelHeader} from 'app/components/panels';

import {t} from 'app/locale';

export default class ReleaseListHeader extends React.Component {
  render() {
    return (
      <PanelHeader>
        <Box flex="1">{t('Version')}</Box>
        <Box w={4 / 12} pl={2} className="hidden-xs" />
        <Box w={2 / 12} pl={2}>
          {t('New Issues')}
        </Box>
        <Box w={2 / 12} pl={2}>
          {t('Last Event')}
        </Box>
      </PanelHeader>
    );
  }
}
