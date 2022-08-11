import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {Flamegraph} from 'sentry/utils/profiling/flamegraph';

interface FlamegraphWarningProps {
  flamegraph: Flamegraph;
}

export function FlamegraphWarnings(props: FlamegraphWarningProps) {
  if (props.flamegraph.profile.samples.length === 0) {
    return (
      <Overlay>
        <p>
          {t(
            'This profile either has no samples or the total duration of frames in the profile is 0.'
          )}
        </p>
      </Overlay>
    );
  }

  return null;
}

const Overlay = styled('div')`
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  display: grid;
  grid: auto/50%;
  place-content: center;
  z-index: ${p => p.theme.zIndex.modal};
  pointer-events: none;
  text-align: center;
`;
