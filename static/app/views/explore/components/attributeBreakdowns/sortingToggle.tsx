import {SegmentedControl} from 'sentry/components/core/segmentedControl';
import {t} from 'sentry/locale';

type SortingMethod = 'rrr' | 'rrf';

interface SortingToggleProps {
  onChange: (value: SortingMethod) => void;
  value: SortingMethod;
}

export function SortingToggle({value, onChange}: SortingToggleProps) {
  return (
    <SegmentedControl value={value} onChange={onChange} size="sm">
      <SegmentedControl.Item
        key="rrr"
        tooltip={t(
          'Relative Risk Ratio (RRR) - Compares the risk of attributes between selected and baseline data and favors lower cardinality attributes'
        )}
      >
        {t('RRR')}
      </SegmentedControl.Item>
      <SegmentedControl.Item
        key="rrf"
        tooltip={t(
          'Reciprocal Rank Fusion (RRF) - Combines multiple ranking signals to identify the most suspicious attributes. WARNING: This method is not finetuned so results may vary.'
        )}
      >
        {t('RRF')}
      </SegmentedControl.Item>
    </SegmentedControl>
  );
}

export type {SortingMethod};
