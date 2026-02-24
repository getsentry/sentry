import styled from '@emotion/styled';

import {TabList, Tabs} from '@sentry/scraps/tabs';

import {t} from 'sentry/locale';
import useUrlParams from 'sentry/utils/url/useUrlParams';

const TABS = {
  details: t('Details'),
  request: t('Request'),
  response: t('Response'),
};

export type TabKey = keyof typeof TABS;

function NetworkDetailsTabs() {
  const {getParamValue, setParamValue} = useUrlParams('n_detail_tab', 'details');
  const activeTab = getParamValue();

  return (
    <TabsContainer>
      <Tabs
        value={activeTab}
        onChange={tab => {
          setParamValue(tab);
        }}
      >
        <TabList>
          {Object.entries(TABS).map(([tab, label]) => (
            <TabList.Item key={tab}>{label}</TabList.Item>
          ))}
        </TabList>
      </Tabs>
    </TabsContainer>
  );
}

const TabsContainer = styled('div')`
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
`;

const StyledNetworkDetailsTabs = styled(NetworkDetailsTabs)`
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

export default StyledNetworkDetailsTabs;
