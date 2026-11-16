import styled from '@emotion/styled';

import {Grid} from '@sentry/scraps/layout';
import {TabList, TabPanels, TabStateProvider} from '@sentry/scraps/tabs';

import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';

import {ReplayMutationTree} from './replayMutationTree';
import {ReplaySideBySideImageDiff} from './replaySideBySideImageDiff';
import {ReplaySliderDiff} from './replaySliderDiff';
import {ReplayTextDiff} from './replayTextDiff';

const enum DiffType {
  HTML = 'html',
  SLIDER = 'slider',
  VISUAL = 'visual',
  MUTATIONS = 'mutations',
}

export function ReplayDiffChooser() {
  const organization = useOrganization();
  const onTabChange = (tabKey: DiffType) => {
    trackAnalytics('replay.hydration-modal.tab-change', {tabKey, organization});
  };

  return (
    <Grid gap="md" height="100%" rows="max-content 1fr">
      <TabStateProvider<DiffType> defaultValue={DiffType.SLIDER} onChange={onTabChange}>
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

const StyledTabPanels = styled(TabPanels)`
  display: flex;
  flex-direction: column;
`;
