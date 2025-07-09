import {type ReactNode} from 'react';
import styled from '@emotion/styled';

import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import {Flex} from 'sentry/components/core/layout';
import {TabList, Tabs} from 'sentry/components/core/tabs';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import useActiveReplayTab, {TabKey} from 'sentry/utils/replays/hooks/useActiveReplayTab';
import useOrganization from 'sentry/utils/useOrganization';

function getReplayTabs({
  isVideoReplay,
  organization,
}: {
  isVideoReplay: boolean;
  organization: Organization;
}): Record<TabKey, ReactNode> {
  // For video replays, we hide the memory tab (not applicable for mobile)
  return {
    [TabKey.AI]: organization.features.includes('replay-ai-summaries') ? (
      <Flex align="center" gap={space(0.75)}>
        {t('AI')}
        <FeatureBadge type="experimental" />
      </Flex>
    ) : null,
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

export default function FocusTabs({isVideoReplay}: Props) {
  const organization = useOrganization();
  const {getActiveTab, setActiveTab} = useActiveReplayTab({isVideoReplay});
  const activeTab = getActiveTab();

  const tabs = Object.entries(getReplayTabs({isVideoReplay, organization})).filter(
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
        <TabList hideBorder>
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
  ${p => (p.theme.isChonk ? '' : `padding-inline: ${space(1)};`)}
  border-bottom: 1px solid ${p => p.theme.border};
`;
