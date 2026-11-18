import {useEffect, type ReactNode} from 'react';

import {FeatureBadge} from '@sentry/scraps/badge';
import {InfoText} from '@sentry/scraps/info';
import {Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Tabs} from '@sentry/scraps/tabs';

import {useOrganizationSeerSetup} from 'sentry/components/events/autofix/useOrganizationSeerSetup';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {TabKey, useActiveReplayTab} from 'sentry/utils/replays/hooks/useActiveReplayTab';
import {useReplayReader} from 'sentry/utils/replays/playback/providers/replayReaderProvider';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjectFromId} from 'sentry/utils/useProjectFromId';
import {hasLogsOnReplays} from 'sentry/views/explore/logs/hasLogsOnReplays';
import type {ReplayRecord} from 'sentry/views/explore/replays/types';

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
}): Array<{key: TabKey; label: ReactNode}> {
  const hasAiSummary =
    organization.features.includes('replay-ai-summaries') && areAiFeaturesAllowed;
  const hasMobileSummary = organization.features.includes('replay-ai-summaries-mobile');
  const hasLogs = hasLogsOnReplays(organization, project, replayRecord);

  return [
    {
      key: TabKey.AI,
      label:
        hasAiSummary && (!isVideoReplay || hasMobileSummary) ? (
          <Flex align="center" gap="sm">
            <InfoText
              variant="inherit"
              title={tct(
                'Powered by generative AI. Learn more about our [link:AI privacy principles].',
                {
                  link: (
                    <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/ai-privacy-and-security/" />
                  ),
                }
              )}
            >
              {t('AI Summary')}
            </InfoText>
            <FeatureBadge type="new" />
          </Flex>
        ) : null,
    },
    {key: TabKey.BREADCRUMBS, label: t('Activity')},
    {key: TabKey.CONSOLE, label: t('Console')},
    {key: TabKey.LOGS, label: hasLogs ? t('Logs') : null},
    {key: TabKey.NETWORK, label: t('Network')},
    {key: TabKey.ERRORS, label: t('Errors')},
    {key: TabKey.TRACE, label: t('Trace')},
    // For video replays, we hide the memory tab (not applicable for mobile)
    {key: TabKey.MEMORY, label: isVideoReplay ? null : t('Memory')},
    {key: TabKey.TAGS, label: t('Tags')},
    {key: TabKey.PLAYLIST, label: t('Playlist')},
  ];
}

type Props = {
  isVideoReplay: boolean;
};

export function FocusTabs({isVideoReplay}: Props) {
  const organization = useOrganization();
  const {areAiFeaturesAllowed} = useOrganizationSeerSetup();
  const {getActiveTab, setActiveTab} = useActiveReplayTab({
    isVideoReplay,
  });
  const activeTab = getActiveTab();
  const replay = useReplayReader();
  const replayRecord = replay?.getReplay();

  const project = useProjectFromId({project_id: replayRecord?.project_id});

  const tabs = getReplayTabs({
    isVideoReplay,
    organization,
    areAiFeaturesAllowed,
    replayRecord,
    project,
  }).filter(({label}) => label !== null);

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
        {({TabList}) => (
          <TabList>
            {tabs.map(({key: tab, label}) => (
              <TabList.Item
                key={tab}
                textValue={tab}
                data-test-id={`replay-details-${tab}-btn`}
              >
                {label}
              </TabList.Item>
            ))}
          </TabList>
        )}
      </Tabs>
    </Stack>
  );
}
