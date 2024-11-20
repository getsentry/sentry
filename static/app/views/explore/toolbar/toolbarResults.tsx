import styled from '@emotion/styled';

import {SegmentedControl} from 'sentry/components/segmentedControl';
import {t} from 'sentry/locale';
import type {ResultMode} from 'sentry/views/explore/hooks/useResultsMode';

import {ToolbarRow, ToolbarSection} from './styles';

interface ToolbarResultsProps {
  resultMode: ResultMode;
  setResultMode: (newMode: ResultMode) => void;
}

export function ToolbarResults({resultMode, setResultMode}: ToolbarResultsProps) {
  return (
    <ToolbarSection data-test-id="section-result-mode">
      <StyledToolbarRow>
        <SegmentedControl
          aria-label={t('Result Mode')}
          value={resultMode}
          onChange={setResultMode}
        >
          <SegmentedControl.Item key={'samples' as const}>
            {t('Samples')}
          </SegmentedControl.Item>
          <SegmentedControl.Item key={'aggregate' as const}>
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
