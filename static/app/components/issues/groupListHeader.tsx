import React from 'react';
import styled from '@emotion/styled';
import {Box, Flex} from 'reflexbox'; // eslint-disable-line no-restricted-imports

import {PanelHeader} from 'app/components/panels';
import {t} from 'app/locale';
import space from 'app/styles/space';

type Props = {
  withChart: boolean;
};

const GroupListHeader = ({withChart = true}: Props) => (
  <PanelHeader disablePadding>
    <Box width={[8 / 12, 8 / 12, 6 / 12]} mx={2} flex="1">
      {t('Issue')}
    </Box>
    {withChart && (
      <Flex
        width={160}
        mx={2}
        justifyContent="space-between"
        className="hidden-xs hidden-sm"
      >
        {t('Graph')}
      </Flex>
    )}
    <EventUserWrapper>{t('events')}</EventUserWrapper>
    <EventUserWrapper>{t('users')}</EventUserWrapper>
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

const EventUserWrapper = styled('div')`
  display: flex;
  justify-content: flex-end;
  align-self: center;
  width: 60px;
  margin: 0 ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints[3]}) {
    width: 80px;
  }
`;
