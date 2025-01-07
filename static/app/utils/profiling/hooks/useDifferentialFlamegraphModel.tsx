import {useMemo} from 'react';
import * as Sentry from '@sentry/react';

import {DifferentialFlamegraph as DifferentialFlamegraphModel} from 'sentry/utils/profiling/differentialFlamegraph';
import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import {useFlamegraphPreferences} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphPreferences';
import {useFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';
import type {Frame} from 'sentry/utils/profiling/frame';
import type {ProfileGroup} from 'sentry/utils/profiling/profile/importProfile';
import {importProfile} from 'sentry/utils/profiling/profile/importProfile';

import type {DifferentialFlamegraphQueryResult} from './useDifferentialFlamegraphQuery';

interface UseDifferentialFlamegraphModelProps {
  after: DifferentialFlamegraphQueryResult['after'];
  before: DifferentialFlamegraphQueryResult['before'];
  negated: boolean;
  frameFilter?: (frame: Frame) => boolean;
}

// Takes API data from a before and after regression response and
// generates a differential flamegraph model.
export function useDifferentialFlamegraphModel(
  props: UseDifferentialFlamegraphModelProps
): {
  afterFlamegraph: Flamegraph | null;
  afterProfileGroup: ProfileGroup | null;
  beforeFlamegraph: Flamegraph | null;
  differentialFlamegraph: DifferentialFlamegraphModel;
} {
  const theme = useFlamegraphTheme();
  const flamegraphPreferences = useFlamegraphPreferences();

  const beforeFlamegraph = useMemo(() => {
    if (!props.before.data) {
      return null;
    }

    const profile = importProfile(
      props.before.data,
      '',
      null,
      'flamegraph',
      props.frameFilter
    );
    return new Flamegraph(profile.profiles[0]!, {
      sort: flamegraphPreferences.sorting,
      inverted: flamegraphPreferences.view === 'bottom up',
    });
  }, [
    props.before.data,
    flamegraphPreferences.sorting,
    flamegraphPreferences.view,
    props.frameFilter,
  ]);

  const afterProfileGroup = useMemo(() => {
    if (!props.after.data) {
      return null;
    }

    return importProfile(
      props.after.data,
      '',
      null,
      'flamegraph',
      props.frameFilter
    ) as ProfileGroup;
  }, [props.after.data, props.frameFilter]);

  const afterFlamegraph = useMemo(() => {
    if (!afterProfileGroup) {
      return null;
    }

    return new Flamegraph(afterProfileGroup.profiles[0]!, {
      sort: flamegraphPreferences.sorting,
      inverted: flamegraphPreferences.view === 'bottom up',
    });
  }, [afterProfileGroup, flamegraphPreferences.sorting, flamegraphPreferences.view]);

  const differentialFlamegraph = useMemo(() => {
    if (!beforeFlamegraph || !afterFlamegraph) {
      return DifferentialFlamegraphModel.Empty();
    }

    const span = Sentry.startInactiveSpan({
      name: 'differential_flamegraph.import',
    });
    const flamegraph = DifferentialFlamegraphModel.FromDiff(
      {
        before: beforeFlamegraph,
        after: afterFlamegraph,
      },
      {negated: props.negated},
      theme
    );
    span?.end();
    return flamegraph;
  }, [beforeFlamegraph, afterFlamegraph, theme, props.negated]);

  return {
    beforeFlamegraph,
    afterFlamegraph,
    differentialFlamegraph,
    afterProfileGroup,
  };
}
