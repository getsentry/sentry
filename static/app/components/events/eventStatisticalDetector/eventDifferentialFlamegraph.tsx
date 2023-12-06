import {Fragment, useEffect, useMemo, useReducer, useState} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import {LocationDescriptor} from 'history';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import PerformanceDuration from 'sentry/components/performanceDuration';
import Placeholder from 'sentry/components/placeholder';
import {DifferentialFlamegraph} from 'sentry/components/profiling/flamegraph/differentialFlamegraph';
import {DifferentialFlamegraphToolbar} from 'sentry/components/profiling/flamegraph/flamegraphToolbar/differentialFlamegraphToolbar';
import {IconChevron} from 'sentry/icons/iconChevron';
import {t} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import {space} from 'sentry/styles/space';
import {Event, Project} from 'sentry/types';
import {formatAbbreviatedNumber, formatPercentage} from 'sentry/utils/formatters';
import {
  CanvasPoolManager,
  useCanvasScheduler,
} from 'sentry/utils/profiling/canvasScheduler';
import {DifferentialFlamegraph as DifferentialFlamegraphModel} from 'sentry/utils/profiling/differentialFlamegraph';
import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import {FlamegraphStateProvider} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/flamegraphContextProvider';
import {FlamegraphThemeProvider} from 'sentry/utils/profiling/flamegraph/flamegraphThemeProvider';
import {useFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';
import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {EventsResultsDataRow} from 'sentry/utils/profiling/hooks/types';
import {
  DifferentialFlamegraphQueryResult,
  useDifferentialFlamegraphQuery,
} from 'sentry/utils/profiling/hooks/useDifferentialFlamegraphQuery';
import {importProfile} from 'sentry/utils/profiling/profile/importProfile';
import {generateProfileFlamechartRouteWithQuery} from 'sentry/utils/profiling/routes';
import {relativeChange} from 'sentry/utils/profiling/units/units';
import useOrganization from 'sentry/utils/useOrganization';
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

  const project = useMemo(() => {
    return ProjectsStore.getById(props.event.projectID);
  }, [props.event.projectID]);

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
            project={project}
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
  project: Project | undefined;
  transaction: EventsResultsDataRow<string> | undefined;
}
function EventDifferentialFlamegraphView(props: EventDifferentialFlamegraphViewProps) {
  const organization = useOrganization();
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

  const [negated, setNegated] = useState<boolean>(false);
  const canvasPoolManager = useMemo(() => new CanvasPoolManager(), []);
  const scheduler = useCanvasScheduler(canvasPoolManager);

  const differentialFlamegraph = useMemo(() => {
    if (!beforeFlamegraph || !afterFlamegraph) {
      return DifferentialFlamegraphModel.Empty();
    }

    if (negated) {
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
  }, [beforeFlamegraph, afterFlamegraph, theme, negated]);

  const makeFunctionFlamechartLink = useMemo(() => {
    return (frame: FlamegraphFrame): LocationDescriptor => {
      if (!props.project) {
        return '';
      }
      if (!frame.profileIds?.length) {
        return '';
      }
      return generateProfileFlamechartRouteWithQuery({
        orgSlug: organization.slug,
        projectSlug: props.project.slug,
        profileId: frame.profileIds?.[0] ?? '',
        query: {
          frameName: frame.frame.name,
          framePackage: frame.frame.package,
        },
      });
    };
  }, [organization.slug, props.project]);

  return (
    <Fragment>
      <DifferentialFlamegraphTransactionToolbar
        transaction={props.transaction}
        onNextTransactionClick={props.onNextTransactionClick}
        onPreviousTransactionClick={props.onPreviousTransactionClick}
      />
      <DifferentialFlamegraphToolbar
        negated={negated}
        onNegatedChange={setNegated}
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

      <DifferentialFlamegraphExplanationBar negated={negated} />

      <DifferentialFlamegraphFunctionsContainer>
        <DifferentialFlamegraphChangedFunctions
          loading={props.after.isLoading || props.before.isLoading}
          title={t('Largest Increase')}
          subtitle={t('after regression')}
          functions={differentialFlamegraph.increasedFrames}
          flamegraph={differentialFlamegraph}
          makeFunctionLink={makeFunctionFlamechartLink}
        />
        <DifferentialFlamegraphChangedFunctions
          loading={props.after.isLoading || props.before.isLoading}
          title={t('Largest Decrease')}
          subtitle={t('after regression')}
          functions={differentialFlamegraph.decreasedFrames}
          flamegraph={differentialFlamegraph}
          makeFunctionLink={makeFunctionFlamechartLink}
        />
      </DifferentialFlamegraphFunctionsContainer>
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

interface PaginationReducerState {
  page: number;
  pageCount: number;
  pageSize: number;
}

type PaginationReducerAction =
  | {type: 'next'}
  | {type: 'previous'}
  | {list: any[]; pageSize: number; type: 'initialize'};

function paginationReducer(
  state: PaginationReducerState,
  action: PaginationReducerAction
): PaginationReducerState {
  switch (action.type) {
    case 'initialize': {
      return {
        page: 0,
        pageCount: Math.ceil(action.list.length / action.pageSize),
        pageSize: action.pageSize,
      };
    }
    case 'next':
      return {
        ...state,
        page: Math.min(state.page + 1, state.pageCount),
      };
    case 'previous':
      return {
        ...state,
        page: Math.max(state.page - 1, 0),
      };
    default:
      return state;
  }
}

interface DifferentialFlamegraphChangedFunctionsProps {
  flamegraph: DifferentialFlamegraphModel;
  functions: DifferentialFlamegraphModel['increasedFrames'];
  loading: boolean;
  makeFunctionLink: (frame: FlamegraphFrame) => LocationDescriptor;
  subtitle: string;
  title: string;
}
function DifferentialFlamegraphChangedFunctions(
  props: DifferentialFlamegraphChangedFunctionsProps
) {
  const [state, dispatch] = useReducer(paginationReducer, {
    page: 0,
    pageSize: 0,
    pageCount: 0,
  });

  useEffect(() => {
    dispatch({
      list: props.functions,
      pageSize: 5,
      type: 'initialize',
    });
  }, [props.functions]);

  const onPreviousPaginationClick = useMemo(() => {
    if (state.page === 0) {
      return undefined;
    }
    return () => dispatch({type: 'previous'});
  }, [state.page]);

  const onNextPaginationClick = useMemo(() => {
    if (state.page + 1 === state.pageCount) {
      return undefined;
    }
    return () => dispatch({type: 'next'});
  }, [state.page, state.pageCount]);

  return (
    <div>
      <DifferentialFlamegraphChangedFunctionsTitle
        title={props.title}
        subtitle={props.subtitle}
        onNextPageClick={onNextPaginationClick}
        onPreviousPageClick={onPreviousPaginationClick}
      />
      {props.loading
        ? new Array(5).fill(0).map((_, idx) => {
            return (
              <DifferentialFlamegraphChangedFunctionContainer key={idx}>
                <div>
                  <Placeholder
                    height="16px"
                    width="66%"
                    style={MARGIN_BOTTOM_PLACEHOLDER_STYLES}
                  />
                  <Placeholder height="16px" width="48%" />
                </div>
                <DifferentialFlamegraphChangedFunctionStats>
                  <Placeholder
                    height="16px"
                    width="32px"
                    style={RIGHT_ALIGN_PLACEHOLDER_STYLES}
                  />
                  <Placeholder height="16px" width="56px" />
                </DifferentialFlamegraphChangedFunctionStats>
              </DifferentialFlamegraphChangedFunctionContainer>
            );
          })
        : props.functions
            .slice(
              state.page * state.pageSize,
              state.page * state.pageSize + state.pageSize
            )
            .map((func, idx) => {
              const countAfter =
                props.flamegraph.afterCounts.get(
                  DifferentialFlamegraphModel.FrameKey(func[1])
                ) ?? 0;
              const countBefore =
                props.flamegraph.beforeCounts.get(
                  DifferentialFlamegraphModel.FrameKey(func[1])
                ) ?? 0;

              const linkToFlamechart = props.makeFunctionLink(func[1]);
              return (
                <DifferentialFlamegraphChangedFunctionContainer key={idx}>
                  <div>
                    <DifferentialFlamegraphChangedFunctionNameLink
                      disabled={!linkToFlamechart}
                      to={linkToFlamechart}
                    >
                      {func[1].frame.name}
                    </DifferentialFlamegraphChangedFunctionNameLink>
                    <DifferentialFlamegraphChangedFunctionModule>
                      {func[1].frame.module ||
                        func[1].frame.package ||
                        func[1].frame.file}
                    </DifferentialFlamegraphChangedFunctionModule>
                  </div>

                  <DifferentialFlamegraphChangedFunctionStats>
                    <div>
                      {countAfter > countBefore ? '+' : ''}
                      {formatPercentage(relativeChange(countAfter, countBefore))}
                      {/* diff % */}
                      {/* n samples, x weight */}
                    </div>
                    <DifferentialFlamegraphFunctionSecondaryStats>
                      {formatAbbreviatedNumber(func[1].node.selfWeight)} {t('samples')}
                    </DifferentialFlamegraphFunctionSecondaryStats>
                  </DifferentialFlamegraphChangedFunctionStats>
                </DifferentialFlamegraphChangedFunctionContainer>
              );
            })}
    </div>
  );
}

const RIGHT_ALIGN_PLACEHOLDER_STYLES: React.CSSProperties = {
  marginBottom: '4px',
  marginLeft: 'auto',
  justifySelf: 'flex-end',
};

const MARGIN_BOTTOM_PLACEHOLDER_STYLES: React.CSSProperties = {
  marginBottom: '4px',
};

const DifferentialFlamegraphChangedFunctionStats = styled('div')`
  text-align: right;
`;

const DifferentialFlamegraphFunctionSecondaryStats = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const DifferentialFlamegraphChangedFunctionNameLink = styled(Link)`
  overflow: hidden;
  text-overflow: ellipsis;
`;

const DifferentialFlamegraphChangedFunctionModule = styled('div')`
  color: ${p => p.theme.subText};
`;

const DifferentialFlamegraphChangedFunctionContainer = styled('div')`
  height: 48px;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  gap: ${space(1)};
  padding: ${space(0.5)} ${space(0)};
  > *:first-child {
    flex: 1;
  }
`;

interface DifferentialFlamegraphExplanationBarProps {
  negated: boolean;
}
function DifferentialFlamegraphExplanationBar(
  props: DifferentialFlamegraphExplanationBarProps
) {
  return (
    <DifferentialFlamegraphExplanationBarContainer>
      <div>
        {props.negated
          ? `Flamegraph is showing how stack frequency will change.`
          : `Flamegraph is showing how stack frequency has changed.`}
      </div>
      <DifferentialFlamegraphLegend />
    </DifferentialFlamegraphExplanationBarContainer>
  );
}

const DifferentialFlamegraphExplanationBarContainer = styled('div')`
  display: flex;
  justify-content: space-between;
  padding: ${space(0.5)} ${space(1)};
  font-size: ${p => p.theme.fontSizeExtraSmall};
  color: ${p => p.theme.subText};
  border-top: 1px solid ${p => p.theme.border};
  background: ${p => p.theme.backgroundSecondary};
`;

function DifferentialFlamegraphLegend() {
  const theme = useFlamegraphTheme();

  const {increaseColor, decreaseColor, neutralColor} = useMemo(() => {
    return {
      increaseColor: theme.COLORS.DIFFERENTIAL_INCREASE.map(n => n * 255)
        .concat(0.8)
        .join(','),
      neutralColor: theme.COLORS.FRAME_FALLBACK_COLOR.slice(0, 3)
        .map(n => n * 255)
        .concat(0.2)
        .join(','),
      decreaseColor: theme.COLORS.DIFFERENTIAL_DECREASE.map(n => n * 255)
        .concat(0.8)
        .join(','),
    };
  }, [theme]);
  return (
    <DifferentialFlamegraphLegendContainer>
      <div>+</div>
      <DifferentialFlamegraphLegendBar
        style={{
          background: `linear-gradient(90deg, rgba(${increaseColor}) 0%, rgba(${neutralColor}) 50%, rgba(${decreaseColor}) 100%)`,
        }}
      />
      <div>-</div>
    </DifferentialFlamegraphLegendContainer>
  );
}

const DifferentialFlamegraphLegendContainer = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
`;

const DifferentialFlamegraphLegendBar = styled('div')`
  width: 60px;
  height: 14px;
  margin: 0 ${space(0.5)};
`;

function DifferentialFlamegraphChangedFunctionsTitle(props: {
  onNextPageClick: (() => void) | undefined;
  onPreviousPageClick: (() => void) | undefined;
  subtitle: string;
  title: string;
}) {
  return (
    <DifferentialFlamegraphChangedFunctionsTitleContainer>
      <DifferentialFlamegraphChangedFunctionsTitleText>
        <div>{props.title}</div>
        <DifferentialFlamegraphChangedFunctionsSubtitleText>
          {props.subtitle}
        </DifferentialFlamegraphChangedFunctionsSubtitleText>
      </DifferentialFlamegraphChangedFunctionsTitleText>
      <ButtonBar merged>
        <DifferentialFlamegraphPaginationButton
          size="xs"
          disabled={!props.onPreviousPageClick}
          onClick={props.onPreviousPageClick}
          icon={<IconChevron direction="left" size="xs" />}
          aria-label={t('Previous page')}
        />
        <DifferentialFlamegraphPaginationButton
          size="xs"
          disabled={!props.onNextPageClick}
          onClick={props.onNextPageClick}
          icon={<IconChevron direction="right" size="xs" />}
          aria-label={t('Next page')}
        />
      </ButtonBar>
    </DifferentialFlamegraphChangedFunctionsTitleContainer>
  );
}

const DifferentialFlamegraphChangedFunctionsTitleContainer = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const DifferentialFlamegraphChangedFunctionsTitleText = styled('div')`
  font-weight: 600;
  flex: 1;
`;

const DifferentialFlamegraphChangedFunctionsSubtitleText = styled('div')`
  font-weight: 400;
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
`;

const DifferentialFlamegraphFunctionsContainer = styled('div')`
  border-top: 1px solid ${p => p.theme.border};
  display: flex;
  flex-direction: row;
  gap: ${space(2)};
  padding: ${space(1)};

  > div {
    flex: 0.5;
  }
`;

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
  height: 360px;
`;
