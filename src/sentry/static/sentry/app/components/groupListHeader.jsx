import React from 'react';
import {Flex, Box} from 'grid-emotion';
import {t} from '../locale';
import {PanelHeader} from './panels';

class GroupListHeader extends React.Component {
  render() {
    return (
      <PanelHeader disablePadding>
        <Box w={[8 / 12, 8 / 12, 6 / 12]} mx={2} flex="1" className="toolbar-header">
          {t('Event')}
        </Box>
        <Box w={120} mx={2} className="toolbar-header hidden-xs hidden-sm">
          {t('Last 24 hours')}
        </Box>
        <Flex w={50} mx={2} justify="flex-end" className="toolbar-header">
          {t('events')}
        </Flex>
        <Flex w={50} mx={2} justify="flex-end" className="toolbar-header">
          {t('users')}
        </Flex>
        <Box w={50} mx={2} className="hidden-xs hidden-sm" />
      </PanelHeader>
    );
  }
}

export default GroupListHeader;
