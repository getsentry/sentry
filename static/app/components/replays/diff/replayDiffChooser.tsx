import styled from '@emotion/styled';

import {ReplaySideBySideImageDiff} from 'sentry/components/replays/diff/replaySideBySideImageDiff';
import {ReplaySliderDiff} from 'sentry/components/replays/diff/replaySliderDiff';
import {ReplayTextDiff} from 'sentry/components/replays/diff/replayTextDiff';
import {TabList, TabPanels, TabStateProvider} from 'sentry/components/tabs';
import {t} from 'sentry/locale';
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
  const organization = useOrganization();
  const onTabChange = (tabKey: DiffType) => {
    trackAnalytics('replay.hydration-modal.tab-change', {tabKey, organization});
  };

  return (
    <Grid>
      <TabStateProvider<DiffType> defaultValue={defaultTab} onChange={onTabChange}>
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
      </TabStateProvider>
    </Grid>
  );
}

const Grid = styled('div')`
  display: grid;
  grid-template-rows: max-content 1fr;
  height: 100%;
`;
