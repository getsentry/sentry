import {SegmentedControl} from 'sentry/components/segmentedControl';
import {t} from 'sentry/locale';
import {DiscoverDatasets} from 'sentry/utils/discover/types';

import {ToolbarHeader, ToolbarHeading, ToolbarSection} from './styles';

interface ToolbarDatasetProps {
  dataset: DiscoverDatasets;
  setDataset: (newExploreDataset: DiscoverDatasets) => void;
}

export function ToolbarDataset({dataset, setDataset}: ToolbarDatasetProps) {
  return (
    <ToolbarSection data-test-id="section-dataset">
      <ToolbarHeader>
        <ToolbarHeading>{t('Dataset')}</ToolbarHeading>
      </ToolbarHeader>
      <SegmentedControl
        size="sm"
        aria-label={t('Dataset')}
        value={dataset}
        onChange={setDataset}
      >
        <SegmentedControl.Item key={DiscoverDatasets.SPANS_EAP}>
          {t('EAP Spans')}
        </SegmentedControl.Item>
        <SegmentedControl.Item key={DiscoverDatasets.SPANS_INDEXED}>
          {t('Indexed Spans')}
        </SegmentedControl.Item>
      </SegmentedControl>
    </ToolbarSection>
  );
}
