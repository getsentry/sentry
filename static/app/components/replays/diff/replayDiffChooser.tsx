import Alert from 'sentry/components/alert';
import {Flex} from 'sentry/components/container/flex';
import {ReplaySideBySideImageDiff} from 'sentry/components/replays/diff/replaySideBySideImageDiff';
import {ReplaySliderDiff} from 'sentry/components/replays/diff/replaySliderDiff';
import {ReplayTextDiff} from 'sentry/components/replays/diff/replayTextDiff';
import {TabList, TabPanels, Tabs} from 'sentry/components/tabs';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import type ReplayReader from 'sentry/utils/replays/replayReader';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  leftOffsetMs: number;
  replay: null | ReplayReader;
  rightOffsetMs: number;
  defaultTab?: DiffType;
}

export const enum DiffType {
  HTML = 'html',
  SLIDER = 'slider',
  VISUAL = 'visual',
}

export default function ReplayDiffChooser({
  defaultTab = DiffType.SLIDER,
  leftOffsetMs,
  replay,
  rightOffsetMs,
}: Props) {
  const isSameTimestamp = leftOffsetMs === rightOffsetMs;

  const organization = useOrganization();
  const onTabChange = (tabKey: DiffType) => {
    trackAnalytics('replay.hydration-modal.tab-change', {tabKey, organization});
  };

  return (
    <Tabs<DiffType> defaultValue={defaultTab} onChange={onTabChange}>
      {isSameTimestamp ? (
        <Alert type="warning" showIcon>
          {t(
            "Sentry wasn't able to identify the correct event to display a diff for this hydration error."
          )}
        </Alert>
      ) : null}

      <Flex gap={space(1)} column>
        <TabList>
          <TabList.Item key={DiffType.SLIDER}>{t('Slider Diff')}</TabList.Item>
          <TabList.Item key={DiffType.VISUAL}>{t('Side By Side Diff')}</TabList.Item>
          <TabList.Item key={DiffType.HTML}>{t('Html Diff')}</TabList.Item>
        </TabList>

        <TabPanels>
          <TabPanels.Item key={DiffType.VISUAL}>
            <ReplaySideBySideImageDiff
              leftOffsetMs={leftOffsetMs}
              replay={replay}
              rightOffsetMs={rightOffsetMs}
            />
          </TabPanels.Item>
          <TabPanels.Item key={DiffType.HTML}>
            <ReplayTextDiff
              leftOffsetMs={leftOffsetMs}
              replay={replay}
              rightOffsetMs={rightOffsetMs}
            />
          </TabPanels.Item>
          <TabPanels.Item key={DiffType.SLIDER}>
            <ReplaySliderDiff
              leftOffsetMs={leftOffsetMs}
              replay={replay}
              rightOffsetMs={rightOffsetMs}
            />
          </TabPanels.Item>
        </TabPanels>
      </Flex>
    </Tabs>
  );
}
