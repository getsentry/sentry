import {SegmentedControl} from '@sentry/scraps/segmentedControl';

import {t} from 'sentry/locale';
import {DrawerTab} from 'sentry/views/issueDetails/groupDistributions/types';

interface Props {
  setTab: (value: DrawerTab) => void;
  tab: DrawerTab;
}

export default function TagFlagPicker({setTab, tab}: Props) {
  return (
    <SegmentedControl size="xs" value={tab} onChange={setTab}>
      <SegmentedControl.Item key={DrawerTab.TAGS}>{t('All Tags')}</SegmentedControl.Item>
      <SegmentedControl.Item key={DrawerTab.FEATURE_FLAGS}>
        {t('All Feature Flags')}
      </SegmentedControl.Item>
    </SegmentedControl>
  );
}
