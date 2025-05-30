import type {ReactNode} from 'react';
import styled from '@emotion/styled';

import {TabList, Tabs} from 'sentry/components/core/tabs';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import useActiveReplayTab, {TabKey} from 'sentry/utils/replays/hooks/useActiveReplayTab';
import useOrganization from 'sentry/utils/useOrganization';

function getReplayTabs({
  isVideoReplay,
  hasLogsFeature,
}: {
  hasLogsFeature: boolean;
  isVideoReplay: boolean;
}): Record<TabKey, ReactNode> {
  // For video replays, we hide the memory tab (not applicable for mobile)

  return {
    [TabKey.BREADCRUMBS]: t('Breadcrumbs'),
    [TabKey.CONSOLE]: t('Console'),
    [TabKey.LOGS]: hasLogsFeature ? t('Logs') : null,
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
  const {getActiveTab, setActiveTab} = useActiveReplayTab({isVideoReplay});
  const hasLogsFeature = useOrganization().features.includes('ourlogs-enabled');
  const activeTab = getActiveTab();

  const tabs = Object.entries(getReplayTabs({isVideoReplay, hasLogsFeature})).filter(
    ([_, v]) => v !== null
  );

  return (
    <TabContainer>
      <Tabs
        value={activeTab}
        onChange={tab => {
          // Navigation is handled by setActiveTab
          setActiveTab(tab);
          trackAnalytics('replay.details-tab-changed', {
            tab,
            organization,
            mobile: isVideoReplay,
          });
        }}
      >
        <TabList>
          {tabs.map(([tab, label]) => (
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
  padding-inline: ${space(1)};
  border-bottom: solid 1px #e0dce5;

  & > * {
    margin-bottom: -1px;
  }
`;

export default FocusTabs;
