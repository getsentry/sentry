import {useEffect, useMemo} from 'react';
import * as Sentry from '@sentry/react';

import {DifferentialFlamegraph} from 'sentry/components/profiling/flamegraph/differentialFlamegraph';
import {Event} from 'sentry/types';
import {
  CanvasPoolManager,
  useCanvasScheduler,
} from 'sentry/utils/profiling/canvasScheduler';
import {DifferentialFlamegraph as DifferentialFlamegraphModel} from 'sentry/utils/profiling/differentialFlamegraph';
import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import {FlamegraphStateProvider} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/flamegraphContextProvider';
import {FlamegraphThemeProvider} from 'sentry/utils/profiling/flamegraph/flamegraphThemeProvider';
import {useFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';
import {
  DifferentialFlamegraphQueryResult,
  useDifferentialFlamegraphQuery,
} from 'sentry/utils/profiling/hooks/useDifferentialFlamegraphQuery';
import {importProfile} from 'sentry/utils/profiling/profile/importProfile';
import {LOADING_PROFILE_GROUP} from 'sentry/views/profiling/profileGroupProvider';

import {useTransactionsDelta} from './transactionsDeltaProvider';

interface EventDifferenialFlamegraphProps {
  event: Event;
}

export function EventDifferenialFlamegraph(props: EventDifferenialFlamegraphProps) {
  const evidenceData = props.event.occurrence?.evidenceData;
  const fingerprint = evidenceData?.fingerprint;
  const breakpoint = evidenceData?.breakpoint;

  const isValid = fingerprint !== undefined && breakpoint !== undefined;

  useEffect(() => {
    if (isValid) {
      return;
    }

    Sentry.withScope(scope => {
      scope.setContext('evidence data fields', {
        fingerprint,
        breakpoint,
      });

      Sentry.captureException(
        new Error('Missing required evidence data on function regression issue.')
      );
    });
  }, [isValid, fingerprint, breakpoint]);

  const projectID = parseInt(props.event.projectID, 10);
  const transactions = useTransactionsDelta();

  const {before, after} = useDifferentialFlamegraphQuery({
    projectID,
    breakpoint,
    environments: [],
    transaction,
  });

  if (!isValid) {
    return null;
  }

  return (
    <div>
      <h3>Differential Flamegraph</h3>
      <FlamegraphThemeProvider>
        <FlamegraphStateProvider
          initialState={{
            preferences: {
              sorting: 'alphabetical',
              view: 'bottom up',
            },
          }}
        >
          <EventDifferentialFlamegraphView before={before} after={after} />
        </FlamegraphStateProvider>
      </FlamegraphThemeProvider>
    </div>
  );
}

interface EventDifferentialFlamegraphViewProps {
  after: DifferentialFlamegraphQueryResult['before'];
  before: DifferentialFlamegraphQueryResult['after'];
}
function EventDifferentialFlamegraphView(props: EventDifferentialFlamegraphViewProps) {
  const theme = useFlamegraphTheme();
  const beforeFlamegraph = useMemo(() => {
    if (!props.before.data) {
      return null;
    }

    // @TODO pass frame filter
    const profile = importProfile(props.before.data, '', 'flamegraph');
    return new Flamegraph(profile.profiles[0], {sort: 'alphabetical'});
  }, [props.before]);

  const afterProfileGroup = useMemo(() => {
    if (!props.after.data) {
      return null;
    }

    return importProfile(props.after.data, '', 'flamegraph');
  }, [props.after]);

  const afterFlamegraph = useMemo(() => {
    if (!afterProfileGroup) {
      return null;
    }

    // @TODO pass frame filter
    return new Flamegraph(afterProfileGroup.profiles[0], {sort: 'alphabetical'});
  }, [afterProfileGroup]);

  const canvasPoolManager = useMemo(() => new CanvasPoolManager(), []);
  const scheduler = useCanvasScheduler(canvasPoolManager);

  const differentialFlamegraph = useMemo(() => {
    if (!beforeFlamegraph || !afterFlamegraph) {
      return DifferentialFlamegraphModel.Empty();
    }

    return DifferentialFlamegraphModel.FromDiff(
      {
        before: beforeFlamegraph,
        after: afterFlamegraph,
      },
      theme
    );
  }, [beforeFlamegraph, afterFlamegraph, theme]);
  return (
    <div style={{height: '500px'}}>
      <DifferentialFlamegraph
        profileGroup={afterProfileGroup ?? LOADING_PROFILE_GROUP}
        differentialFlamegraph={differentialFlamegraph}
        canvasPoolManager={canvasPoolManager}
        scheduler={scheduler}
      />
    </div>
  );
}
