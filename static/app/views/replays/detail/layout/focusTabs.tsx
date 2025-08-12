import {type ReactNode} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';
import {TabList, Tabs} from 'sentry/components/core/tabs';
import {Tooltip} from 'sentry/components/core/tooltip';
import {useOrganizationSeerSetup} from 'sentry/components/events/autofix/useOrganizationSeerSetup';
import {IconLab} from 'sentry/icons/iconLab';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import useActiveReplayTab, {TabKey} from 'sentry/utils/replays/hooks/useActiveReplayTab';
import useOrganization from 'sentry/utils/useOrganization';
import {hasLogsOnReplays} from 'sentry/views/explore/logs/utils';

function getReplayTabs({
  isVideoReplay,
  organization,
  areAiFeaturesAllowed,
}: {
  areAiFeaturesAllowed: boolean;
  isVideoReplay: boolean;
  organization: Organization;
}): Record<TabKey, ReactNode> {
  // For video replays, we hide the memory tab (not applicable for mobile)
  return {
    [TabKey.AI]:
      organization.features.includes('replay-ai-summaries') && areAiFeaturesAllowed ? (
        <Flex align="center" gap="sm">
          {t('Summary')}
          <Tooltip
            title={t(
              'This feature is experimental! Try it out and let us know what you think. No promises!'
            )}
          >
            <IconLab isSolid />
          </Tooltip>
        </Flex>
      ) : null,
    [TabKey.BREADCRUMBS]: t('Breadcrumbs'),
    [TabKey.CONSOLE]: t('Console'),
    [TabKey.LOGS]: hasLogsOnReplays(organization) ? t('Logs') : null,
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
  const {areAiFeaturesAllowed} = useOrganizationSeerSetup();
  const {getActiveTab, setActiveTab} = useActiveReplayTab({isVideoReplay});
  const activeTab = getActiveTab();

  const tabs = Object.entries(
    getReplayTabs({isVideoReplay, organization, areAiFeaturesAllowed})
  ).filter(([_, v]) => v !== null);

  return (
    <TabContainer>
      <Tabs
        size="xs"
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
  display: flex;
  flex-direction: column;
  flex-wrap: nowrap;
  min-width: 0;

  ${p =>
    p.theme.isChonk
      ? ''
      : css`
          padding-inline: ${space(1)};
          border-bottom: 1px solid ${p.theme.border};
          margin-bottom: -1px;
        `}
`;
