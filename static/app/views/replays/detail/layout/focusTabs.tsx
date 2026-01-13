import {useEffect, type ReactNode} from 'react';

import {FeatureBadge} from '@sentry/scraps/badge';
import {ExternalLink} from '@sentry/scraps/link/link';
import {Tooltip} from '@sentry/scraps/tooltip/tooltip';

import {Flex, Stack} from 'sentry/components/core/layout';
import {TabList, Tabs} from 'sentry/components/core/tabs';
import {useOrganizationSeerSetup} from 'sentry/components/events/autofix/useOrganizationSeerSetup';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import useActiveReplayTab, {TabKey} from 'sentry/utils/replays/hooks/useActiveReplayTab';
import {useReplayReader} from 'sentry/utils/replays/playback/providers/replayReaderProvider';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectFromId from 'sentry/utils/useProjectFromId';
import {hasLogsOnReplays} from 'sentry/views/explore/logs/hasLogsOnReplays';
import type {ReplayRecord} from 'sentry/views/replays/types';

function getReplayTabs({
  isVideoReplay,
  organization,
  areAiFeaturesAllowed,
  replayRecord,
  project,
}: {
  areAiFeaturesAllowed: boolean;
  isVideoReplay: boolean;
  organization: Organization;
  project?: Project | null;
  replayRecord?: ReplayRecord | null;
}): Record<TabKey, ReactNode> {
  const hasAiSummary =
    organization.features.includes('replay-ai-summaries') && areAiFeaturesAllowed;
  const hasMobileSummary = organization.features.includes('replay-ai-summaries-mobile');
  const hasLogs = hasLogsOnReplays(organization, project, replayRecord);

  return {
    [TabKey.AI]:
      hasAiSummary && (!isVideoReplay || hasMobileSummary) ? (
        <Flex align="center" gap="sm">
          <Tooltip
            isHoverable
            title={tct(
              `Powered by generative AI. Learn more about our [link:AI privacy principles].`,
              {
                link: (
                  <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/ai-privacy-and-security/" />
                ),
              }
            )}
          >
            {t('AI Summary')}
          </Tooltip>
          <FeatureBadge type="new" />
        </Flex>
      ) : null,
    [TabKey.BREADCRUMBS]: t('Breadcrumbs'),
    [TabKey.CONSOLE]: t('Console'),
    [TabKey.LOGS]: hasLogs ? t('Logs') : null,
    [TabKey.NETWORK]: t('Network'),
    [TabKey.ERRORS]: t('Errors'),
    [TabKey.TRACE]: t('Trace'),
    // For video replays, we hide the memory tab (not applicable for mobile)
    [TabKey.MEMORY]: isVideoReplay ? null : t('Memory'),
    [TabKey.TAGS]: t('Tags'),
    [TabKey.PLAYLIST]: organization.features.includes('replay-playlist-view')
      ? t('Playlist')
      : null,
  };
}

type Props = {
  isVideoReplay: boolean;
};

export default function FocusTabs({isVideoReplay}: Props) {
  const organization = useOrganization();
  const {areAiFeaturesAllowed} = useOrganizationSeerSetup();
  const {getActiveTab, setActiveTab} = useActiveReplayTab({
    isVideoReplay,
  });
  const activeTab = getActiveTab();
  const replay = useReplayReader();
  const replayRecord = replay?.getReplay();

  const project = useProjectFromId({project_id: replayRecord?.project_id});

  const tabs = Object.entries(
    getReplayTabs({
      isVideoReplay,
      organization,
      areAiFeaturesAllowed,
      replayRecord,
      project,
    })
  ).filter(([_, v]) => v !== null);

  useEffect(() => {
    const hasAiSummary =
      organization.features.includes('replay-ai-summaries') && areAiFeaturesAllowed;
    const hasMobileSummary = organization.features.includes('replay-ai-summaries-mobile');

    const isAiTabAvailable = hasAiSummary && (!isVideoReplay || hasMobileSummary);

    if (isAiTabAvailable) {
      trackAnalytics('replay.ai_tab_shown', {
        organization,
      });
    }
  }, [organization, areAiFeaturesAllowed, isVideoReplay]);

  return (
    <Stack wrap="nowrap" minWidth="0">
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
        <TabList>
          {tabs.map(([tab, label]) => (
            <TabList.Item
              key={tab}
              textValue={tab}
              data-test-id={`replay-details-${tab}-btn`}
            >
              {label}
            </TabList.Item>
          ))}
        </TabList>
      </Tabs>
    </Stack>
  );
}
