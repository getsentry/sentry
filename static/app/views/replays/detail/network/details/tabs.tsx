import styled from '@emotion/styled';

import {TabList, Tabs} from 'sentry/components/core/tabs';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
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
    padding-right: ${space(3)};
    background: ${p => p.theme.colors.surface500};
    z-index: ${p => p.theme.zIndex.initial};
  }
  & > li:first-child {
    padding-left: ${space(2)};
  }
  & > li:last-child {
    padding-right: ${space(1)};
  }

  & > li > a {
    padding-top: ${space(1)};
    padding-bottom: ${space(0.5)};
    height: 100%;
    border-bottom: ${space(0.5)} solid transparent;
  }
`;

export default StyledNetworkDetailsTabs;
