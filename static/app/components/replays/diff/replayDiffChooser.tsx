import styled from '@emotion/styled';

import FeatureBadge from 'sentry/components/badge/featureBadge';
import {ReplayMutationTree} from 'sentry/components/replays/diff/replayMutationTree';
import {ReplaySideBySideImageDiff} from 'sentry/components/replays/diff/replaySideBySideImageDiff';
import {ReplaySliderDiff} from 'sentry/components/replays/diff/replaySliderDiff';
import {ReplayTextDiff} from 'sentry/components/replays/diff/replayTextDiff';
import {TabList, TabPanels, TabStateProvider} from 'sentry/components/tabs';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import type ReplayReader from 'sentry/utils/replays/replayReader';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  leftOffsetMs: number;
  replay: ReplayReader;
  rightOffsetMs: number;
  defaultTab?: DiffType;
}

export const enum DiffType {
  HTML = 'html',
  SLIDER = 'slider',
  VISUAL = 'visual',
  MUTATIONS = 'mutations',
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
          <TabList.Item key={DiffType.MUTATIONS}>
            {t('Mutations')} <FeatureBadge type={'beta'} />
          </TabList.Item>
          <TabList.Item key={DiffType.HTML}>
            {t('HTML Diff')} <FeatureBadge type={'beta'} />
          </TabList.Item>
        </TabList>

        <StyledTabPanels>
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
          <TabPanels.Item key={DiffType.MUTATIONS}>
            <ReplayMutationTree
              leftOffsetMs={leftOffsetMs}
              replay={replay}
              rightOffsetMs={rightOffsetMs}
            />
          </TabPanels.Item>
        </StyledTabPanels>
      </TabStateProvider>
    </Grid>
  );
}

const Grid = styled('div')`
  display: grid;
  grid-template-rows: max-content 1fr;
  height: 100%;
  gap: ${space(1)};
`;

const StyledTabPanels = styled(TabPanels)`
  display: flex;
  flex-direction: column;
`;
