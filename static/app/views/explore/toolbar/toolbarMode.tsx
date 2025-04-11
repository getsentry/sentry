import {SegmentedControl} from 'sentry/components/core/segmentedControl';
import {t} from 'sentry/locale';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';

import {ToolbarControlRow, ToolbarSection} from './styles';

interface ToolbarModeProps {
  mode: Mode;
  setMode: (mode: Mode) => void;
}

export function ToolbarMode({mode, setMode}: ToolbarModeProps) {
  return (
    <ToolbarSection data-test-id="section-mode">
      <ToolbarControlRow>
        <SegmentedControl aria-label={t('Result Mode')} value={mode} onChange={setMode}>
          <SegmentedControl.Item key={Mode.SAMPLES}>{t('Samples')}</SegmentedControl.Item>
          <SegmentedControl.Item key={Mode.AGGREGATE}>
            {t('Aggregates')}
          </SegmentedControl.Item>
        </SegmentedControl>
      </ToolbarControlRow>
    </ToolbarSection>
  );
}
