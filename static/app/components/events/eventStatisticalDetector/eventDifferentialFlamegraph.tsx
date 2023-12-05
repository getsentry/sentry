import {Fragment, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import PerformanceDuration from 'sentry/components/performanceDuration';
import Placeholder from 'sentry/components/placeholder';
import {DifferentialFlamegraph} from 'sentry/components/profiling/flamegraph/differentialFlamegraph';
import {DifferentialFlamegraphToolbar} from 'sentry/components/profiling/flamegraph/flamegraphToolbar/differentialFlamegraphToolbar';
import {IconChevron} from 'sentry/icons/iconChevron';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
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
import {EventsResultsDataRow} from 'sentry/utils/profiling/hooks/types';
import {
  DifferentialFlamegraphQueryResult,
  useDifferentialFlamegraphQuery,
} from 'sentry/utils/profiling/hooks/useDifferentialFlamegraphQuery';
import {importProfile} from 'sentry/utils/profiling/profile/importProfile';
import {relativeChange} from 'sentry/utils/profiling/units/units';
import {LOADING_PROFILE_GROUP} from 'sentry/views/profiling/profileGroupProvider';

import {useTransactionsDelta} from './transactionsDeltaProvider';

interface EventDifferentialFlamegraphProps {
  event: Event;
}

export function EventDifferentialFlamegraph(props: EventDifferentialFlamegraphProps) {
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

  const transactions = useTransactionsDelta();
  const [transaction, setTransaction] = useState<
    EventsResultsDataRow<string> | undefined
  >(undefined);

  if (transaction === undefined) {
    const firstTransaction = transactions?.data?.data?.[0];
    if (firstTransaction) {
      setTransaction(firstTransaction);
    }
  }

  const {before, after} = useDifferentialFlamegraphQuery({
    projectID: parseInt(props.event.projectID, 10),
    breakpoint,
    environments: [],
    transaction: (transaction?.transaction as string) ?? '',
  });

  const onNextTransactionClick = useMemo(() => {
    if (!transaction) {
      return undefined;
    }
    const idx = transactions?.data?.data?.indexOf?.(transaction) ?? -1;
    if (idx === -1 || idx === (transactions?.data?.data?.length ?? 0) - 1) {
      return undefined;
    }

    return () => {
      setTransaction(transactions?.data?.data?.[idx + 1] ?? transaction);
    };
  }, [transaction, transactions?.data?.data]);

  const onPreviousTransactionClick = useMemo(() => {
    if (!transaction) {
      return undefined;
    }
    const idx = transactions?.data?.data?.indexOf?.(transaction) ?? -1;
    if (idx === -1 || idx === 0) {
      return undefined;
    }
    return () => {
      setTransaction(transactions?.data?.data?.[idx - 1] ?? transaction);
    };
  }, [transaction, transactions?.data?.data]);

  return (
    <Fragment>
      <FlamegraphThemeProvider>
        <FlamegraphStateProvider
          initialState={{
            preferences: {
              sorting: 'alphabetical',
              view: 'bottom up',
            },
          }}
        >
          <EventDifferentialFlamegraphView
            onNextTransactionClick={onNextTransactionClick}
            onPreviousTransactionClick={onPreviousTransactionClick}
            transaction={transaction}
            before={before}
            after={after}
          />
        </FlamegraphStateProvider>
      </FlamegraphThemeProvider>
    </Fragment>
  );
}

interface EventDifferentialFlamegraphViewProps {
  after: DifferentialFlamegraphQueryResult['before'];
  before: DifferentialFlamegraphQueryResult['after'];
  onNextTransactionClick: (() => void) | undefined;
  onPreviousTransactionClick: (() => void) | undefined;
  transaction: EventsResultsDataRow<string> | undefined;
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

  const [source, setSource] = useState<'before' | 'after'>('after');
  const canvasPoolManager = useMemo(() => new CanvasPoolManager(), []);
  const scheduler = useCanvasScheduler(canvasPoolManager);

  const differentialFlamegraph = useMemo(() => {
    if (!beforeFlamegraph || !afterFlamegraph) {
      return DifferentialFlamegraphModel.Empty();
    }

    if (source === 'before') {
      return DifferentialFlamegraphModel.FromDiff(
        {
          before: afterFlamegraph,
          after: beforeFlamegraph,
        },
        theme
      );
    }

    return DifferentialFlamegraphModel.FromDiff(
      {
        before: beforeFlamegraph,
        after: afterFlamegraph,
      },
      theme
    );
  }, [beforeFlamegraph, afterFlamegraph, theme, source]);

  return (
    <Fragment>
      <DifferentialFlamegraphTransactionToolbar
        transaction={props.transaction}
        onNextTransactionClick={props.onNextTransactionClick}
        onPreviousTransactionClick={props.onPreviousTransactionClick}
      />
      <DifferentialFlamegraphToolbar
        source={source}
        onSourceChange={setSource}
        flamegraph={differentialFlamegraph}
        canvasPoolManager={canvasPoolManager}
      />
      <DifferentialFlamegraphContainer>
        {props.after.isLoading || props.before.isLoading ? (
          <LoadingIndicatorContainer>
            <LoadingIndicator />
          </LoadingIndicatorContainer>
        ) : props.before.isError && props.after.isError ? (
          <ErrorMessageContainer>
            {t('Failed to load flamegraph for before and after regression time range.')}
          </ErrorMessageContainer>
        ) : props.before.isError ? (
          <ErrorMessageContainer>
            {t('Failed to load flamegraph for before regression time range.')}
          </ErrorMessageContainer>
        ) : props.after.isError ? (
          <ErrorMessageContainer>
            {t('Failed to load flamegraph for after regression time range.')}
          </ErrorMessageContainer>
        ) : null}
        <DifferentialFlamegraph
          profileGroup={afterProfileGroup ?? LOADING_PROFILE_GROUP}
          differentialFlamegraph={differentialFlamegraph}
          canvasPoolManager={canvasPoolManager}
          scheduler={scheduler}
        />
      </DifferentialFlamegraphContainer>
    </Fragment>
  );
}

const numberFormatter = Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
});

interface DifferentialFlamegraphTransactionToolbarProps {
  onNextTransactionClick: (() => void) | undefined;
  onPreviousTransactionClick: (() => void) | undefined;
  transaction: EventsResultsDataRow<string> | undefined;
}
function DifferentialFlamegraphTransactionToolbar(
  props: DifferentialFlamegraphTransactionToolbarProps
) {
  const [before, after] = useMemo(() => {
    if (!props.transaction) {
      return [0, 0];
    }

    const keys = Object.keys(props.transaction);

    let beforePercentile = 0;
    let afterPercentile = 0;

    for (const key of keys) {
      if (key.startsWith('percentile_after')) {
        afterPercentile = props.transaction[key] as number;
      }
      if (key.startsWith('percentile_before')) {
        beforePercentile = props.transaction[key] as number;
      }
    }

    return [beforePercentile, afterPercentile];
  }, [props.transaction]);

  return (
    <DifferentialFlamegraphTransactionToolbarContainer>
      {props.transaction?.transaction ? (
        <DifferentialFlamegraphTransactionName>
          {props.transaction.transaction}
        </DifferentialFlamegraphTransactionName>
      ) : (
        <Placeholder height="20px" width="66%" />
      )}

      {props.transaction ? (
        <span>
          <PerformanceDuration nanoseconds={before} abbreviation />
          <DifferentialFlamegraphRegressionChange>
            {after === 0 || before === 0
              ? ''
              : '+' + numberFormatter.format(relativeChange(after, before) * 100) + '%'}
          </DifferentialFlamegraphRegressionChange>
        </span>
      ) : (
        <Fragment>
          <Placeholder height="20px" width="60px" />
          <Placeholder height="20px" width="60px" />
        </Fragment>
      )}
      <ButtonBar merged>
        <DifferentialFlamegraphPaginationButton
          icon={<IconChevron direction="left" size="xs" />}
          aria-label={t('Previous Transaction')}
          size="xs"
          disabled={!props.onPreviousTransactionClick}
          onClick={props.onPreviousTransactionClick}
        />
        <DifferentialFlamegraphPaginationButton
          icon={<IconChevron direction="right" size="xs" />}
          aria-label={t('Next Transaction')}
          size="xs"
          disabled={!props.onNextTransactionClick}
          onClick={props.onNextTransactionClick}
        />
      </ButtonBar>
    </DifferentialFlamegraphTransactionToolbarContainer>
  );
}

const DifferentialFlamegraphPaginationButton = styled(Button)`
  padding-left: ${space(0.75)};
  padding-right: ${space(0.75)};
`;
const DifferentialFlamegraphTransactionName = styled('div')`
  font-weight: 600;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const DifferentialFlamegraphRegressionChange = styled('span')`
  margin-left: ${space(1)};
  color: ${p => p.theme.red300};
`;

const DifferentialFlamegraphTransactionToolbarContainer = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${space(1)};
  gap: ${space(1)};
  border-bottom: 1px solid ${p => p.theme.border};
`;

const ErrorMessageContainer = styled('div')`
  position: absolute;
  display: flex;
  flex-direction: column;
  justify-content: center;
  width: 100%;
  height: 100%;
  background-color: ${p => p.theme.background};
  color: ${p => p.theme.subText};
  text-align: center;
  padding: ${space(2)} ${space(4)};
`;

const LoadingIndicatorContainer = styled('div')`
  position: absolute;
  display: flex;
  flex-direction: column;
  justify-content: center;
  width: 100%;
  height: 100%;
`;

const DifferentialFlamegraphContainer = styled('div')`
  position: relative;
  width: 100%;
  height: 500px;
`;
