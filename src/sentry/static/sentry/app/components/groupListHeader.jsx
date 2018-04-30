import React from 'react';
import {Flex, Box} from 'grid-emotion';
import {t} from 'app/locale';
import {PanelHeader} from 'app/components/panels';

class GroupListHeader extends React.Component {
  render() {
    return (
      <PanelHeader disablePadding>
        <Box w={[8 / 12, 8 / 12, 6 / 12]} mx={2} flex="1" className="toolbar-header">
          {t('Event')}
        </Box>
        <Box w={160} mx={2} className="toolbar-header hidden-xs hidden-sm">
          {t('Last 24 hours')}
        </Box>
        <Flex w={80} mx={2} justify="flex-end" className="toolbar-header">
          {t('events')}
        </Flex>
        <Flex w={80} mx={2} justify="flex-end" className="toolbar-header">
          {t('users')}
        </Flex>
        <Flex
          w={80}
          mx={2}
          justify="flex-end"
          className="hidden-xs hidden-sm toolbar-header"
        >
          {t('Assignee')}
        </Flex>
      </PanelHeader>
    );
  }
}

export default GroupListHeader;
