import type {ReactNode} from 'react';
import styled from '@emotion/styled';

import {TabList, Tabs} from 'sentry/components/tabs';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import useActiveReplayTab, {TabKey} from 'sentry/utils/replays/hooks/useActiveReplayTab';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';

function getReplayTabs({
  isVideoReplay,
}: {
  isVideoReplay: boolean;
}): Record<TabKey, ReactNode> {
  // For video replays, we hide the memory tab (not applicable for mobile)
  return {
    [TabKey.BREADCRUMBS]: t('Breadcrumbs'),
    [TabKey.CONSOLE]: t('Console'),
    [TabKey.NETWORK]: t('Network'),
    [TabKey.ERRORS]: t('Errors'),
    [TabKey.TRACE]: t('Trace'),
    [TabKey.MEMORY]: isVideoReplay ? null : t('Memory'),
    [TabKey.TAGS]: t('Tags'),
  };
}

type Props = {
  isVideoReplay: boolean;
};

function FocusTabs({isVideoReplay}: Props) {
  const organization = useOrganization();
  const {pathname, query} = useLocation();
  const navigate = useNavigate();
  const {getActiveTab, setActiveTab} = useActiveReplayTab({isVideoReplay});
  const activeTab = getActiveTab();

  return (
    <TabContainer>
      <Tabs
        value={activeTab}
        onChange={tab => {
          setActiveTab(tab);
          navigate({
            pathname,
            query: {...query, t_main: tab},
          });
          trackAnalytics('replay.details-tab-changed', {
            tab,
            organization,
            mobile: isVideoReplay,
          });
        }}
      >
        <TabList>
          {Object.entries(getReplayTabs({isVideoReplay})).map(([tab, label]) => (
            <TabList.Item key={tab} data-test-id={`replay-details-${tab}-btn`}>
              {label}
            </TabList.Item>
          ))}
        </TabList>
      </Tabs>
    </TabContainer>
  );
}

const TabContainer = styled('div')`
  margin-bottom: ${space(1)};
`;

export default FocusTabs;
