import styled from '@emotion/styled';
import {parseAsStringLiteral, useQueryState} from 'nuqs';

import {Stack} from '@sentry/scraps/layout';
import {Tabs} from '@sentry/scraps/tabs';

import {t} from 'sentry/locale';

const TABS = ['details', 'request', 'response'] as const;

export type TabKey = (typeof TABS)[number];

const TAB_LABELS: Record<TabKey, string> = {
  details: t('Details'),
  request: t('Request'),
  response: t('Response'),
};

export const networkDetailsTabParser = parseAsStringLiteral(TABS).withDefault('details');

function NetworkDetailsTabs() {
  const [activeTab, setActiveTab] = useQueryState(
    'n_detail_tab',
    networkDetailsTabParser
  );

  return (
    <TabsContainer>
      <Tabs value={activeTab} onChange={tab => setActiveTab(tab)}>
        {({TabList}) => (
          <Stack flexGrow={1} minWidth="0" flexBasis="0" alignSelf="stretch">
            <TabList>
              {TABS.map(tab => (
                <TabList.Item key={tab}>{TAB_LABELS[tab]}</TabList.Item>
              ))}
            </TabList>
          </Stack>
        )}
      </Tabs>
    </TabsContainer>
  );
}

const TabsContainer = styled('div')`
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
`;

export const StyledNetworkDetailsTabs = styled(NetworkDetailsTabs)`
  /*
  Use padding instead of margin so all the <li> will cover the <SplitDivider>
  without taking 100% width.
  */

  & > li {
    margin-right: 0;
    padding-right: ${p => p.theme.space['2xl']};
    background: ${p => p.theme.tokens.background.primary};
    z-index: ${p => p.theme.zIndex.initial};
  }
  & > li:first-child {
    padding-left: ${p => p.theme.space.xl};
  }
  & > li:last-child {
    padding-right: ${p => p.theme.space.md};
  }

  & > li > a {
    padding-top: ${p => p.theme.space.md};
    padding-bottom: ${p => p.theme.space.xs};
    height: 100%;
    border-bottom: ${p => p.theme.space.xs} solid transparent;
  }
`;
