import {useCallback} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {DifferentialFlamegraphNegationSwitch} from 'sentry/components/profiling/flamegraph/flamegraphToolbar/differentialFlamegraphNegationSwitch';
import {FlamegraphSearch} from 'sentry/components/profiling/flamegraph/flamegraphToolbar/flamegraphSearch';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {CanvasPoolManager} from 'sentry/utils/profiling/canvasScheduler';
import {DifferentialFlamegraph} from 'sentry/utils/profiling/differentialFlamegraph';

import {DifferentialFlamegraphSettingsButton} from './differentialFlamegraphSettingsButton';

const EMPTY_SPANS = [];

interface DifferentialFlamegraphProps {
  canvasPoolManager: CanvasPoolManager;
  flamegraph: DifferentialFlamegraph;
  frameFilter: 'application' | 'system' | 'all';
  negated: boolean;
  onFrameFilterChange: (type: 'application' | 'system' | 'all') => void;
  onNegatedChange: (source: boolean) => void;
}
export function DifferentialFlamegraphToolbar(props: DifferentialFlamegraphProps) {
  const onResetZoom = useCallback(() => {
    props.canvasPoolManager.dispatch('reset zoom', []);
  }, [props.canvasPoolManager]);

  return (
    <DifferentialFlamegraphToolbarContainer>
      <DifferentialFlamegraphNegationSwitch
        onNegatedChange={props.onNegatedChange}
        negated={props.negated}
      />
      <FlamegraphSearch
        spans={EMPTY_SPANS}
        flamegraphs={props.flamegraph}
        canvasPoolManager={props.canvasPoolManager}
      />
      <Button size="xs" onClick={onResetZoom}>
        {t('Reset Zoom')}
      </Button>
      <DifferentialFlamegraphSettingsButton
        frameFilter={props.frameFilter}
        onFrameFilterChange={props.onFrameFilterChange}
      />
    </DifferentialFlamegraphToolbarContainer>
  );
}

export const DifferentialFlamegraphToolbarContainer = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${space(1)};
  gap: ${space(1)};
  border-bottom: 1px solid ${p => p.theme.border};
`;
