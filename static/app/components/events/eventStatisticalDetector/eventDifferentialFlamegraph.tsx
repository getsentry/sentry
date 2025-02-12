import {Fragment, useCallback, useEffect, useMemo, useReducer, useState} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import type {LocationDescriptor} from 'history';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import Placeholder from 'sentry/components/placeholder';
import {DifferentialFlamegraph} from 'sentry/components/profiling/flamegraph/differentialFlamegraph';
import {DifferentialFlamegraphToolbar} from 'sentry/components/profiling/flamegraph/flamegraphToolbar/differentialFlamegraphToolbar';
import {IconChevron} from 'sentry/icons/iconChevron';
import {t} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import {
  CanvasPoolManager,
  useCanvasScheduler,
} from 'sentry/utils/profiling/canvasScheduler';
import {colorComponentsToRGBA} from 'sentry/utils/profiling/colors/utils';
import type {DifferentialFlamegraph as DifferentialFlamegraphModel} from 'sentry/utils/profiling/differentialFlamegraph';
import {FlamegraphStateProvider} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/flamegraphContextProvider';
import {FlamegraphThemeProvider} from 'sentry/utils/profiling/flamegraph/flamegraphThemeProvider';
import {useFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';
import type {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import type {Frame} from 'sentry/utils/profiling/frame';
import {useDifferentialFlamegraphModel} from 'sentry/utils/profiling/hooks/useDifferentialFlamegraphModel';
import type {DifferentialFlamegraphQueryResult} from 'sentry/utils/profiling/hooks/useDifferentialFlamegraphQuery';
import {useDifferentialFlamegraphQuery} from 'sentry/utils/profiling/hooks/useDifferentialFlamegraphQuery';
import {generateProfileRouteFromProfileReference} from 'sentry/utils/profiling/routes';
import {relativeChange} from 'sentry/utils/profiling/units/units';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {LOADING_PROFILE_GROUP} from 'sentry/views/profiling/profileGroupProvider';

interface EventDifferentialFlamegraphProps {
  event: Event;
}

export function EventDifferentialFlamegraph(props: EventDifferentialFlamegraphProps) {
  const selection = usePageFilters();
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

  const {before, after} = useDifferentialFlamegraphQuery({
    projectID: parseInt(props.event.projectID, 10),
    breakpoint,
    environments: selection.selection.environments,
    fingerprint: props.event.occurrence?.evidenceData?.fingerprint,
  });

  return (
    <Fragment>
      <FlamegraphThemeProvider>
        <FlamegraphStateProvider
          initialState={{
            preferences: {
              sorting: 'alphabetical',
              view: 'top down',
            },
          }}
        >
          <EventDifferentialFlamegraphView
            project={project}
            before={before}
            after={after}
          />
        </FlamegraphStateProvider>
      </FlamegraphThemeProvider>
    </Fragment>
  );
}

function applicationFrameOnly(frame: Frame): boolean {
  return frame.is_application;
}

function systemFrameOnly(frame: Frame): boolean {
  return !frame.is_application;
}

interface EventDifferentialFlamegraphViewProps {
  after: DifferentialFlamegraphQueryResult['before'];
  before: DifferentialFlamegraphQueryResult['after'];
  project: Project | undefined;
}
function EventDifferentialFlamegraphView(props: EventDifferentialFlamegraphViewProps) {
  const organization = useOrganization();

  const [frameFilterSetting, setFrameFilterSetting] = useState<
    'application' | 'system' | 'all'
  >('all');

  const frameFilter =
    frameFilterSetting === 'application'
      ? applicationFrameOnly
      : frameFilterSetting === 'system'
        ? systemFrameOnly
        : undefined;

  const [negated, setNegated] = useState<boolean>(false);
  const canvasPoolManager = useMemo(() => new CanvasPoolManager(), []);
  const scheduler = useCanvasScheduler(canvasPoolManager);

  const {differentialFlamegraph, afterProfileGroup} = useDifferentialFlamegraphModel({
    before: props.before,
    after: props.after,
    negated,
    frameFilter,
  });

  const makeFunctionFlamechartLink = useCallback(
    (frame: FlamegraphFrame): LocationDescriptor => {
      if (!props.project) {
        return '';
      }
      if (!frame.profileIds?.length) {
        return '';
      }
      const profile = frame.profileIds?.[0];

      if (!defined(profile)) {
        return '';
      }

      return (
        generateProfileRouteFromProfileReference({
          organization,
          projectSlug: props.project.slug,
          reference: profile,
          framePackage: frame.frame.package,
          frameName: frame.frame.name,
        }) ?? ''
      );
    },
    [organization, props.project]
  );

  return (
    <FlamegraphContainer>
      <StyledPanel>
        <DifferentialFlamegraphToolbar
          frameFilter={frameFilterSetting}
          onFrameFilterChange={setFrameFilterSetting}
          negated={negated}
          onNegatedChange={setNegated}
          flamegraph={differentialFlamegraph}
          canvasPoolManager={canvasPoolManager}
        />
        <DifferentialFlamegraphContainer>
          {props.after.isPending || props.before.isPending ? (
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
      </StyledPanel>

      <StyledPanel>
        <DifferentialFlamegraphFunctionsContainer>
          <DifferentialFlamegraphChangedFunctions
            loading={props.after.isPending || props.before.isPending}
            title={t('Slower functions')}
            subtitle={t('after regression')}
            functions={differentialFlamegraph.increasedFrames}
            flamegraph={differentialFlamegraph}
            makeFunctionLink={makeFunctionFlamechartLink}
          />
          <DifferentialFlamegraphChangedFunctions
            loading={props.after.isPending || props.before.isPending}
            title={t('Faster functions')}
            subtitle={t('after regression')}
            functions={differentialFlamegraph.decreasedFrames}
            flamegraph={differentialFlamegraph}
            makeFunctionLink={makeFunctionFlamechartLink}
          />
        </DifferentialFlamegraphFunctionsContainer>
      </StyledPanel>

      <StyledPanel>
        <DifferentialFlamegraphFunctionsContainer>
          <DifferentialFlamegraphChangedFunctions
            loading={props.after.isPending || props.before.isPending}
            title={t('New functions')}
            subtitle={t('after regression')}
            functions={differentialFlamegraph.newFrames}
            flamegraph={differentialFlamegraph}
            makeFunctionLink={makeFunctionFlamechartLink}
          />
          <DifferentialFlamegraphChangedFunctions
            loading={props.after.isPending || props.before.isPending}
            title={t('Removed functions')}
            subtitle={t('after regression')}
            functions={differentialFlamegraph.removedFrames}
            flamegraph={differentialFlamegraph}
            makeFunctionLink={makeFunctionFlamechartLink}
          />
        </DifferentialFlamegraphFunctionsContainer>
      </StyledPanel>
    </FlamegraphContainer>
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
        page: Math.min(state.page + 1, state.pageCount - 1),
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
  functions:
    | DifferentialFlamegraphModel['increasedFrames']
    | DifferentialFlamegraphModel['newFrames'];
  loading: boolean;
  makeFunctionLink: (frame: FlamegraphFrame) => LocationDescriptor;
  subtitle: string;
  title: string;
}
function DifferentialFlamegraphChangedFunctions(
  props: DifferentialFlamegraphChangedFunctionsProps
) {
  const theme = useFlamegraphTheme();
  const [state, dispatch] = useReducer(paginationReducer, {
    page: 0,
    pageSize: 0,
    pageCount: 0,
  });

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
  useEffect(() => {
    dispatch({
      list: props.functions,
      pageSize: 5,
      type: 'initialize',
    });
  }, [props.functions]);

  return (
    <DifferentialFlamegraphFunctionsWrapper>
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
            .map((f, idx) => {
              const frame = f;
              if (!frame) {
                throw new Error('Frame is falsy, this should never happen');
              }
              const change = props.flamegraph.weights.get(frame.node);
              const linkToFlamechart = props.makeFunctionLink(frame);

              return (
                <DifferentialFlamegraphChangedFunctionContainer key={idx}>
                  <div>
                    <DifferentialFlamegraphChangedFunctionNameLink
                      disabled={!linkToFlamechart}
                      to={linkToFlamechart}
                    >
                      <DifferentialFlamegraphFunctionColorIndicator
                        style={{
                          backgroundColor: colorComponentsToRGBA(
                            props.flamegraph.colors.get(frame.node) ??
                              theme.COLORS.FRAME_FALLBACK_COLOR
                          ),
                        }}
                      />
                      <span>{frame.frame.name}</span>
                    </DifferentialFlamegraphChangedFunctionNameLink>
                    <DifferentialFlamegraphChangedFunctionModule>
                      {frame.frame.module || frame.frame.package || frame.frame.file}
                    </DifferentialFlamegraphChangedFunctionModule>
                  </div>

                  {change ? (
                    <DifferentialFlamegraphChangedFunctionStats>
                      <div>
                        {change.after > change.before ? '+' : ''}
                        {formatPercentage(relativeChange(change.after, change.before))}
                        {/* diff % */}
                        {/* n samples, x weight */}
                      </div>
                      <DifferentialFlamegraphFunctionSecondaryStats>
                        {formatAbbreviatedNumber(f.node.totalWeight)} {t('samples')}
                      </DifferentialFlamegraphFunctionSecondaryStats>
                    </DifferentialFlamegraphChangedFunctionStats>
                  ) : null}
                </DifferentialFlamegraphChangedFunctionContainer>
              );
            })}
    </DifferentialFlamegraphFunctionsWrapper>
  );
}

const DifferentialFlamegraphFunctionsWrapper = styled('div')`
  flex: 1;
  width: 50%;
  &:first-child {
    padding-right: ${space(0.5)};
  }
  &:nth-child(2) {
    padding-left: ${space(0.5)};
  }
`;

const DifferentialFlamegraphFunctionColorIndicator = styled('div')`
  width: 10px;
  height: 10px;
  border-radius: 2px;
  display: inline-block;
  border: 1px solid ${p => p.theme.border};
  margin-right: ${space(0.25)};
  background-color: ${p => p.theme.green300};
`;

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
  flex-shrink: 0;
`;

const DifferentialFlamegraphFunctionSecondaryStats = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const DifferentialFlamegraphChangedFunctionNameLink = styled(Link)`
  display: flex;
  flex-direction: row;
  align-items: center;
  white-space: nowrap;

  > span {
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }
`;

const DifferentialFlamegraphChangedFunctionModule = styled('div')`
  color: ${p => p.theme.subText};
  min-width: 0;
  text-overflow: ellipsis;
  overflow: hidden;
`;

const DifferentialFlamegraphChangedFunctionContainer = styled('div')`
  height: 48px;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  gap: ${space(1)};
  padding: ${space(0.5)} 0;

  > *:first-child {
    min-width: 0;
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
          ? t(`Flamegraph is showing how stack frequency will change.`)
          : t(`Flamegraph is showing how stack frequency has changed.`)}
      </div>
      <DifferentialFlamegraphLegend />
    </DifferentialFlamegraphExplanationBarContainer>
  );
}

const DifferentialFlamegraphExplanationBarContainer = styled('div')`
  display: flex;
  justify-content: space-between;
  border-radius: 0 0 ${p => p.theme.borderRadius} ${p => p.theme.borderRadius};
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
          icon={<IconChevron direction="left" />}
          aria-label={t('Previous page')}
        />
        <DifferentialFlamegraphPaginationButton
          size="xs"
          disabled={!props.onNextPageClick}
          onClick={props.onNextPageClick}
          icon={<IconChevron direction="right" />}
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
  font-weight: ${p => p.theme.fontWeightBold};
  flex: 1;
`;

const DifferentialFlamegraphChangedFunctionsSubtitleText = styled('div')`
  font-weight: ${p => p.theme.fontWeightNormal};
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
`;

const DifferentialFlamegraphFunctionsContainer = styled('div')`
  display: flex;
  flex-direction: row;
  padding: ${space(1)};
`;

const DifferentialFlamegraphPaginationButton = styled(Button)`
  padding-left: ${space(0.75)};
  padding-right: ${space(0.75)};
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
  height: 420px;
`;

const FlamegraphContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1.5)};
`;

const StyledPanel = styled(Panel)`
  margin-bottom: 0;
`;
