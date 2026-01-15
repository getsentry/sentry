import {useMemo} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {FlamegraphPreview} from 'sentry/components/profiling/flamegraph/flamegraphPreview';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Frame} from 'sentry/types/event';
import {colorComponentsToRGBA} from 'sentry/utils/profiling/colors/utils';
import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import {FlamegraphThemeProvider} from 'sentry/utils/profiling/flamegraph/flamegraphThemeProvider';
import {useFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';
import {SampledProfile} from 'sentry/utils/profiling/profile/sampledProfile';

import {
  buildFrameTree,
  createStacktraceFrameIndex,
  treeToSampledProfileData,
} from './utils';

interface StacktraceFlamegraphProps {
  frames: Frame[];
}

export function StacktraceFlamegraph({frames}: StacktraceFlamegraphProps) {
  const flamegraph = useMemo(() => {
    // Build tree from frames using parent_frame_index
    const roots = buildFrameTree(frames);

    // Convert tree to samples/weights format
    const {samples, weights} = treeToSampledProfileData(roots);

    // If no samples, return empty flamegraph
    if (samples.length === 0) {
      return Flamegraph.Empty();
    }

    // Create frame index for profiling
    const frameIndex = createStacktraceFrameIndex(frames);

    // Calculate total weight for duration
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);

    // Create sampled profile data
    const sampledProfileData: Profiling.SampledProfile = {
      type: 'sampled',
      name: 'Stacktrace',
      unit: 'count',
      threadID: 0,
      startValue: 0,
      endValue: totalWeight,
      samples,
      weights,
    };

    // Create profile from sampled data
    const profile = SampledProfile.FromProfile(sampledProfileData, frameIndex, {
      type: 'flamegraph',
    });

    // Create flamegraph model with left-heavy sorting
    return new Flamegraph(profile, {
      inverted: false,
      sort: 'left heavy',
    });
  }, [frames]);

  // Calculate duration for preview
  const duration = flamegraph.configSpace.width || 1;

  return (
    <FlamegraphThemeProvider>
      <FlamegraphWrapper>
        <FlamegraphLegend />
        <FlamegraphContainer>
          <FlamegraphPreview
            flamegraph={flamegraph}
            relativeStartTimestamp={0}
            relativeStopTimestamp={duration}
          />
        </FlamegraphContainer>
      </FlamegraphWrapper>
    </FlamegraphThemeProvider>
  );
}

function FlamegraphLegend() {
  const theme = useFlamegraphTheme();
  const applicationFrameColor = colorComponentsToRGBA(
    theme.COLORS.FRAME_APPLICATION_COLOR
  );
  const systemFrameColor = colorComponentsToRGBA(theme.COLORS.FRAME_SYSTEM_COLOR);

  return (
    <Flex gap="lg">
      <LegendItem>
        <LegendMarker color={applicationFrameColor} />
        {t('Application Function')}
      </LegendItem>
      <LegendItem>
        <LegendMarker color={systemFrameColor} />
        {t('System Function')}
      </LegendItem>
    </Flex>
  );
}

const FlamegraphWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const FlamegraphContainer = styled('div')`
  height: 300px;
  position: relative;
  border-radius: ${p => p.theme.radius.md};
  overflow: hidden;
`;

const LegendItem = styled('span')`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: ${space(0.5)};
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.sm};
`;

const LegendMarker = styled('span')<{color: string}>`
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 1px;
  background-color: ${p => p.color};
`;
