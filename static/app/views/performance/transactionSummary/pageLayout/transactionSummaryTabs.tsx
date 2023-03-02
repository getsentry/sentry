import FeatureBadge from 'sentry/components/featureBadge';
import ReplayCountBadge from 'sentry/components/replays/replayCountBadge';
import ReplaysFeatureBadge from 'sentry/components/replays/replaysFeatureBadge';
import {TabList} from 'sentry/components/tabs';
import {t} from 'sentry/locale';

import Tab from './tabs';

type Props = {
  hasAnomalyDetection: boolean;
  hasProfiling: boolean;
  hasSessionReplay: boolean;
  renderWebVitals: boolean;
  replaysCount: undefined | number;
};

function TransactionSummaryTabs({
  hasAnomalyDetection,
  hasProfiling,
  hasSessionReplay,
  renderWebVitals,
  replaysCount,
}: Props) {
  return (
    <TabList
      hideBorder
      outerWrapStyles={{
        gridColumn: '1 / -1',
      }}
    >
      <TabList.Item key={Tab.TransactionSummary}>{t('Overview')}</TabList.Item>
      <TabList.Item key={Tab.Events}>{t('All Events')}</TabList.Item>
      <TabList.Item key={Tab.Tags}>{t('Tags')}</TabList.Item>
      <TabList.Item key={Tab.Spans}>{t('Spans')}</TabList.Item>
      <TabList.Item key={Tab.Anomalies} hidden={!hasAnomalyDetection}>
        {t('Anomalies')}
        <FeatureBadge type="alpha" noTooltip />
      </TabList.Item>
      <TabList.Item key={Tab.WebVitals} hidden={!renderWebVitals}>
        {t('Web Vitals')}
      </TabList.Item>
      <TabList.Item key={Tab.Replays} hidden={!hasSessionReplay}>
        {t('Replays')}
        <ReplayCountBadge count={replaysCount} />
        <ReplaysFeatureBadge noTooltip />
      </TabList.Item>
      <TabList.Item key={Tab.Profiling} hidden={!hasProfiling}>
        {t('Profiling')}
        <FeatureBadge type="beta" noTooltip />
      </TabList.Item>
    </TabList>
  );
}

export default TransactionSummaryTabs;
