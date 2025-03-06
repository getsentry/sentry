import styled from '@emotion/styled';

import {ReplayMutationTree} from 'sentry/components/replays/diff/replayMutationTree';
import {ReplaySideBySideImageDiff} from 'sentry/components/replays/diff/replaySideBySideImageDiff';
import {ReplaySliderDiff} from 'sentry/components/replays/diff/replaySliderDiff';
import {ReplayTextDiff} from 'sentry/components/replays/diff/replayTextDiff';
import {TabList, TabPanels, TabStateProvider} from 'sentry/components/tabs';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  defaultTab?: DiffType;
}

export const enum DiffType {
  HTML = 'html',
  SLIDER = 'slider',
  VISUAL = 'visual',
  MUTATIONS = 'mutations',
}

export default function ReplayDiffChooser({defaultTab = DiffType.SLIDER}: Props) {
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
          <TabList.Item key={DiffType.MUTATIONS}>{t('Mutations')}</TabList.Item>
          <TabList.Item key={DiffType.HTML}>{t('HTML Diff')}</TabList.Item>
        </TabList>

        <StyledTabPanels>
          <TabPanels.Item key={DiffType.VISUAL}>
            <ReplaySideBySideImageDiff />
          </TabPanels.Item>
          <TabPanels.Item key={DiffType.HTML}>
            <ReplayTextDiff />
          </TabPanels.Item>
          <TabPanels.Item key={DiffType.SLIDER}>
            <ReplaySliderDiff />
          </TabPanels.Item>
          <TabPanels.Item key={DiffType.MUTATIONS}>
            <ReplayMutationTree />
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
