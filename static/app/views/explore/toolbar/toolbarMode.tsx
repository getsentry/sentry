import styled from '@emotion/styled';

import {SegmentedControl} from 'sentry/components/segmentedControl';
import {t} from 'sentry/locale';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';

import {ToolbarRow, ToolbarSection} from './styles';

interface ToolbarModeProps {
  mode: Mode;
  setMode: (mode: Mode) => void;
}

export function ToolbarMode({mode, setMode}: ToolbarModeProps) {
  return (
    <ToolbarSection data-test-id="section-mode">
      <StyledToolbarRow>
        <SegmentedControl aria-label={t('Result Mode')} value={mode} onChange={setMode}>
          <SegmentedControl.Item key={Mode.SAMPLES}>{t('Samples')}</SegmentedControl.Item>
          <SegmentedControl.Item key={Mode.AGGREGATE}>
            {t('Aggregates')}
          </SegmentedControl.Item>
        </SegmentedControl>
      </StyledToolbarRow>
    </ToolbarSection>
  );
}

const StyledToolbarRow = styled(ToolbarRow)`
  > div {
    flex-grow: 1;

    > label > :last-child {
      flex-grow: 1;
    }
  }
`;
