import {Flex, Box} from 'reflexbox';

import {t} from 'app/locale';
import {PanelHeader} from 'app/components/panels';

type Props = {
  withChart: boolean;
};

const GroupListHeader = ({withChart = true}: Props) => (
  <PanelHeader disablePadding>
    <Box width={[8 / 12, 8 / 12, 6 / 12]} mx={2} flex="1" className="toolbar-header">
      {t('Issue')}
    </Box>
    {withChart && (
      <Box width={160} mx={2} className="toolbar-header hidden-xs hidden-sm">
        {t('Last 24 hours')}
      </Box>
    )}
    <Flex width={80} mx={2} justifyContent="flex-end" className="toolbar-header">
      {t('events')}
    </Flex>
    <Flex width={80} mx={2} justifyContent="flex-end" className="toolbar-header">
      {t('users')}
    </Flex>
    <Flex
      width={80}
      mx={2}
      justifyContent="flex-end"
      className="hidden-xs hidden-sm toolbar-header"
    >
      {t('Assignee')}
    </Flex>
  </PanelHeader>
);

export default GroupListHeader;
