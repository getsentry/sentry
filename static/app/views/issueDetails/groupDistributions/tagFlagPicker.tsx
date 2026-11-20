import {SegmentedControl} from '@sentry/scraps/segmentedControl';

import {t} from 'sentry/locale';

import {DrawerTab} from './types';

interface Props {
  setTab: (value: DrawerTab) => void;
  tab: DrawerTab;
}

export function TagFlagPicker({setTab, tab}: Props) {
  return (
    <SegmentedControl size="sm" value={tab} onChange={setTab}>
      <SegmentedControl.Item key={DrawerTab.TAGS}>{t('All Tags')}</SegmentedControl.Item>
      <SegmentedControl.Item key={DrawerTab.FEATURE_FLAGS}>
        {t('All Feature Flags')}
      </SegmentedControl.Item>
    </SegmentedControl>
  );
}
