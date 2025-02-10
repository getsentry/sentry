import {useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import {Button} from 'sentry/components/button';
import {CompactSelect} from 'sentry/components/compactSelect';
import type {SelectOption} from 'sentry/components/compactSelect/types';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {AggregateFlamegraph} from 'sentry/components/profiling/flamegraph/aggregateFlamegraph';
import {AggregateFlamegraphTreeTable} from 'sentry/components/profiling/flamegraph/aggregateFlamegraphTreeTable';
import {FlamegraphSearch} from 'sentry/components/profiling/flamegraph/flamegraphToolbar/flamegraphSearch';
import {
  formatWeightToProfileDuration,
  PROFILING_SAMPLES_FORMATTER,
} from 'sentry/components/profiling/flamegraph/flamegraphTooltip';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import TextOverflow from 'sentry/components/textOverflow';
import {Tooltip} from 'sentry/components/tooltip';
import {IconCopy, IconGithub, IconOpen} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type {DeepPartial} from 'sentry/types/utils';
import type {CanvasScheduler} from 'sentry/utils/profiling/canvasScheduler';
import {
  CanvasPoolManager,
  useCanvasScheduler,
} from 'sentry/utils/profiling/canvasScheduler';
import type {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import type {FlamegraphState} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/flamegraphContext';
import {FlamegraphStateProvider} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/flamegraphContextProvider';
import {FlamegraphThemeProvider} from 'sentry/utils/profiling/flamegraph/flamegraphThemeProvider';
import type {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import type {Frame} from 'sentry/utils/profiling/frame';
import {useAggregateFlamegraphQuery} from 'sentry/utils/profiling/hooks/useAggregateFlamegraphQuery';
import {useSourceCodeLink} from 'sentry/utils/profiling/hooks/useSourceLink';
import type {ProfileGroup} from 'sentry/utils/profiling/profile/importProfile';
import {generateProfileRouteFromProfileReference} from 'sentry/utils/profiling/routes';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {
  FlamegraphProvider,
  useFlamegraph,
} from 'sentry/views/profiling/flamegraphProvider';
import {
  ProfileGroupProvider,
  useProfileGroup,
} from 'sentry/views/profiling/profileGroupProvider';

const DEFAULT_FLAMEGRAPH_PREFERENCES: DeepPartial<FlamegraphState> = {
  preferences: {
    sorting: 'left heavy' satisfies FlamegraphState['preferences']['sorting'],
  },
};

const noop = () => void 0;

function decodeViewOrDefault(
  value: string | string[] | null | undefined,
  defaultValue: 'flamegraph' | 'profiles'
): 'flamegraph' | 'profiles' {
  if (!value || Array.isArray(value)) {
    return defaultValue;
  }
  if (value === 'flamegraph' || value === 'profiles') {
    return value;
  }
  return defaultValue;
}

interface AggregateFlamegraphToolbarProps {
  canvasPoolManager: CanvasPoolManager;
  frameFilter: 'system' | 'application' | 'all';
  hideSystemFrames: boolean;
  onFrameFilterChange: (value: 'system' | 'application' | 'all') => void;
  onHideRegressionsClick: () => void;
  onVisualizationChange: (value: 'flamegraph' | 'call tree') => void;
  scheduler: CanvasScheduler;
  setHideSystemFrames: (value: boolean) => void;
  visualization: 'flamegraph' | 'call tree';
}

function AggregateFlamegraphToolbar(props: AggregateFlamegraphToolbarProps) {
  const flamegraph = useFlamegraph();
  const flamegraphs = useMemo(() => [flamegraph], [flamegraph]);
  const spans = useMemo(() => [], []);

  const frameSelectOptions: Array<SelectOption<'system' | 'application' | 'all'>> =
    useMemo(() => {
      return [
        {value: 'system', label: t('System Frames')},
        {value: 'application', label: t('Application Frames')},
        {value: 'all', label: t('All Frames')},
      ];
    }, []);

  const onResetZoom = useCallback(() => {
    props.scheduler.dispatch('reset zoom');
  }, [props.scheduler]);

  const onFrameFilterChange = useCallback(
    (value: {value: 'application' | 'system' | 'all'}) => {
      props.onFrameFilterChange(value.value);
    },
    [props]
  );

  return (
    <AggregateFlamegraphToolbarContainer>
      <ViewSelectContainer>
        <SegmentedControl
          aria-label={t('View')}
          size="xs"
          value={props.visualization}
          onChange={props.onVisualizationChange}
        >
          <SegmentedControl.Item key="flamegraph">
            {t('Flamegraph')}
          </SegmentedControl.Item>
          <SegmentedControl.Item key="call tree">{t('Call Tree')}</SegmentedControl.Item>
        </SegmentedControl>
      </ViewSelectContainer>
      <AggregateFlamegraphSearch
        spans={spans}
        canvasPoolManager={props.canvasPoolManager}
        flamegraphs={flamegraphs}
      />
      <Button size="xs" onClick={onResetZoom}>
        {t('Reset Zoom')}
      </Button>
      <CompactSelect
        size="xs"
        onChange={onFrameFilterChange}
        value={props.frameFilter}
        options={frameSelectOptions}
      />
    </AggregateFlamegraphToolbarContainer>
  );
}

export function LandingAggregateFlamegraph(): React.ReactNode {
  const location = useLocation();

  const {data, status} = useAggregateFlamegraphQuery({
    dataSource: 'profiles',
  });

  const [visualization, setVisualization] = useLocalStorageState<
    'flamegraph' | 'call tree'
  >('flamegraph-visualization', 'flamegraph');

  const onVisualizationChange = useCallback(
    (value: 'flamegraph' | 'call tree') => {
      setVisualization(value);
    },
    [setVisualization]
  );

  const [hideRegressions, setHideRegressions] = useLocalStorageState<boolean>(
    'flamegraph-hide-regressions',
    false
  );
  const [frameFilter, setFrameFilter] = useLocalStorageState<
    'system' | 'application' | 'all'
  >('flamegraph-frame-filter', 'application');

  const onFrameFilterChange = useCallback(
    (value: 'system' | 'application' | 'all') => {
      setFrameFilter(value);
    },
    [setFrameFilter]
  );

  const onResetFrameFilter = useCallback(() => {
    setFrameFilter('all');
  }, [setFrameFilter]);

  const flamegraphFrameFilter: ((frame: Frame) => boolean) | undefined = useMemo(() => {
    if (frameFilter === 'all') {
      return () => true;
    }
    if (frameFilter === 'application') {
      return frame => frame.is_application;
    }
    return frame => !frame.is_application;
  }, [frameFilter]);

  const canvasPoolManager = useMemo(() => new CanvasPoolManager(), []);
  const scheduler = useCanvasScheduler(canvasPoolManager);

  const [view, setView] = useState<'flamegraph' | 'profiles'>(
    decodeViewOrDefault(location.query.view, 'flamegraph')
  );

  useEffect(() => {
    const newView = decodeViewOrDefault(location.query.view, 'flamegraph');
    if (newView !== view) {
      setView(decodeViewOrDefault(location.query.view, 'flamegraph'));
    }
  }, [location.query.view, view]);

  const onHideRegressionsClick = useCallback(() => {
    return setHideRegressions(!hideRegressions);
  }, [hideRegressions, setHideRegressions]);

  return (
    <ProfileGroupProvider
      traceID=""
      type="flamegraph"
      input={data ?? null}
      frameFilter={flamegraphFrameFilter}
    >
      <FlamegraphStateProvider initialState={DEFAULT_FLAMEGRAPH_PREFERENCES}>
        <FlamegraphThemeProvider>
          <FlamegraphProvider>
            <AggregateFlamegraphContainer>
              <AggregateFlamegraphToolbar
                scheduler={scheduler}
                canvasPoolManager={canvasPoolManager}
                visualization={visualization}
                onVisualizationChange={onVisualizationChange}
                frameFilter={frameFilter}
                onFrameFilterChange={onFrameFilterChange}
                hideSystemFrames={false}
                setHideSystemFrames={noop}
                onHideRegressionsClick={onHideRegressionsClick}
              />
              {status === 'pending' ? (
                <RequestStateMessageContainer>
                  <LoadingIndicator />
                </RequestStateMessageContainer>
              ) : status === 'error' ? (
                <RequestStateMessageContainer>
                  {t('There was an error loading the flamegraph.')}
                </RequestStateMessageContainer>
              ) : null}
              {visualization === 'flamegraph' ? (
                <AggregateFlamegraphCanvasContainer>
                  <AggregateFlamegraph
                    filter={frameFilter}
                    status={status}
                    onResetFilter={onResetFrameFilter}
                    canvasPoolManager={canvasPoolManager}
                    scheduler={scheduler}
                  />
                  <AggregateFlamegraphFunctionBreakdown scheduler={scheduler} />
                </AggregateFlamegraphCanvasContainer>
              ) : (
                <AggregateFlamegraphTreeTable
                  recursion={null}
                  expanded={false}
                  withoutBorders
                  frameFilter={frameFilter}
                  canvasPoolManager={canvasPoolManager}
                />
              )}
            </AggregateFlamegraphContainer>
          </FlamegraphProvider>
        </FlamegraphThemeProvider>
      </FlamegraphStateProvider>
    </ProfileGroupProvider>
  );
}

interface AggregateFlamegraphFunctionBreakdownProps {
  scheduler: CanvasScheduler;
}

function AggregateFlamegraphFunctionBreakdown(
  props: AggregateFlamegraphFunctionBreakdownProps
) {
  const {projects} = useProjects();
  const organization = useOrganization();
  const flamegraph = useFlamegraph();
  const profileGroup = useProfileGroup();
  const [nodes, setNodes] = useState<FlamegraphFrame[] | null>(null);

  useEffect(() => {
    function onFrameHighlight(
      frames: FlamegraphFrame[] | null,
      type: 'hover' | 'selected'
    ) {
      if (type === 'selected') {
        setNodes(frames);
      }
    }

    props.scheduler.on('highlight frame', onFrameHighlight);

    return () => {
      props.scheduler.off('highlight frame', onFrameHighlight);
    };
  }, [props.scheduler, setNodes]);

  const example = nodes?.[0];
  const projectsLookupTable = useMemo(() => {
    return projects.reduce(
      (acc, project) => {
        acc[project.id] = project;
        return acc;
      },
      {} as Record<string, Project>
    );
  }, [projects]);

  const callers = useMemo(() => {
    if (!nodes) {
      return [];
    }

    const results: FlamegraphFrame[] = [];
    for (const node of nodes) {
      // Filter out the virtual root node
      if (node.parent && node.parent !== flamegraph.root) {
        results.push(node.parent);
      }
    }
    return results.sort((a, b) => b.frame.totalWeight - a.frame.totalWeight);
  }, [nodes, flamegraph.root]);

  const callees = useMemo(() => {
    if (!nodes) {
      return [];
    }

    const results: FlamegraphFrame[] = [];
    for (const node of nodes) {
      for (const child of node.children) {
        results.push(child);
      }
    }
    return results.sort((a, b) => b.frame.totalWeight - a.frame.totalWeight);
  }, [nodes]);

  const onFrameHover = useCallback(
    (frame: FlamegraphFrame) => {
      props.scheduler.dispatch('highlight frame', [frame], 'hover');
    },
    [props.scheduler]
  );

  const onFrameClick = useCallback(
    (frame: FlamegraphFrame) => {
      props.scheduler.dispatch('highlight frame', [frame], 'selected');
    },
    [props.scheduler]
  );

  if (!nodes) {
    return null;
  }

  if (!example) {
    return null;
  }

  return (
    <AggregateFlamegraphFunctionBreakdownContainer>
      <AggregateFlamegraphSectionHeader>
        {t('Function Information')}
      </AggregateFlamegraphSectionHeader>
      <AggregateFlamegraphSection>
        <AggregateFlamegraphFunctionBreakdownHeader>
          <AggregateFlamegraphFunction
            frame={example}
            flamegraph={flamegraph}
            onFrameHover={onFrameHover}
            onFrameClick={onFrameClick}
            organization={organization}
            profileGroup={profileGroup}
          />
        </AggregateFlamegraphFunctionBreakdownHeader>
      </AggregateFlamegraphSection>
      <AggregateFlamegraphSectionHeader>
        {tct('Called By ([count])', {count: callers.length})}
      </AggregateFlamegraphSectionHeader>
      <AggregateFlamegraphSection>
        {!callers.length ? (
          <AggregateFlamegraphFunctionBreakdownEmptyState>
            <Tooltip
              title={t(
                'When a function has no callers, it means that it is a root function.'
              )}
            >
              {t('No callers detected.')}
            </Tooltip>
          </AggregateFlamegraphFunctionBreakdownEmptyState>
        ) : (
          callers.map((caller, c) => (
            <AggregateFlamegraphFunction
              key={c}
              frame={caller}
              flamegraph={flamegraph}
              onFrameHover={onFrameHover}
              onFrameClick={onFrameClick}
              organization={organization}
              profileGroup={profileGroup}
            />
          ))
        )}
      </AggregateFlamegraphSection>
      <AggregateFlamegraphSectionHeader>
        {tct('Calls ([count])', {count: callees.length})}
      </AggregateFlamegraphSectionHeader>
      <AggregateFlamegraphSection>
        {!callees.length ? (
          <AggregateFlamegraphFunctionBreakdownEmptyState>
            <Tooltip
              title={t(
                'When a function has no callees, it likely means that it is a leaf function, or that the profiler did not collect any samples of its callees yet.'
              )}
            >
              {t('No callees detected.')}
            </Tooltip>
          </AggregateFlamegraphFunctionBreakdownEmptyState>
        ) : (
          callees.map((callee, c) => (
            <AggregateFlamegraphFunction
              key={c}
              frame={callee}
              flamegraph={flamegraph}
              onFrameHover={onFrameHover}
              onFrameClick={onFrameClick}
              organization={organization}
              profileGroup={profileGroup}
            />
          ))
        )}
      </AggregateFlamegraphSection>
      <AggregateFlamegraphSectionHeader>
        <Tooltip title={t('Example profiles where this function was called.')}>
          {tct('Profiles ([count])', {count: example.profileIds?.length})}
        </Tooltip>
      </AggregateFlamegraphSectionHeader>
      <AggregateFlamegraphSection>
        {!example.profileIds?.length ? (
          <AggregateFlamegraphFunctionBreakdownEmptyState>
            {t('No profiles detected.')}
          </AggregateFlamegraphFunctionBreakdownEmptyState>
        ) : (
          example.profileIds?.map((e, i) => {
            return (
              <AggregateFlamegraphProfileReference
                key={i}
                profile={e}
                frameName={example.frame.name}
                framePackage={example.frame.package}
                projectLookupTable={projectsLookupTable}
              />
            );
          })
        )}
      </AggregateFlamegraphSection>
    </AggregateFlamegraphFunctionBreakdownContainer>
  );
}

function AggregateFlamegraphFunction(props: {
  flamegraph: Flamegraph;
  frame: FlamegraphFrame;
  onFrameClick: (frame: FlamegraphFrame) => void;
  onFrameHover: (frame: FlamegraphFrame) => void;
  organization: Organization;
  profileGroup: ProfileGroup;
}) {
  const source =
    (props.frame.frame.file ? `${props.frame.frame.getSourceLocation()}` : null) ??
    '<unknown>';

  return (
    <AggregateFlamegraphFunctionContainer
      onPointerOver={() => props.onFrameHover(props.frame)}
    >
      <AggregateFlamegraphFunctionNameRow>
        <AggregateFlamegraphFunctionName onClick={() => props.onFrameClick(props.frame)}>
          {props.frame.frame.name}
        </AggregateFlamegraphFunctionName>
        <AggregateFlamegraphFunctionSource>
          <TextOverflow>{source}</TextOverflow>
        </AggregateFlamegraphFunctionSource>
      </AggregateFlamegraphFunctionNameRow>
      <AggregateFlamegraphSourceRow>
        <AggregateFlamegraphFunctionSamples>
          <div>
            <AggregateFlamegraphFunctionActionsDropdown
              frame={props.frame}
              profileGroup={props.profileGroup}
              organization={props.organization}
            />
          </div>
          <div>
            {PROFILING_SAMPLES_FORMATTER.format(props.frame.frame.totalWeight)}{' '}
            {t('samples') + ' '}
            {`(${formatWeightToProfileDuration(props.frame.node, props.flamegraph)})`}{' '}
          </div>
        </AggregateFlamegraphFunctionSamples>
      </AggregateFlamegraphSourceRow>
    </AggregateFlamegraphFunctionContainer>
  );
}

function AggregateFlamegraphFunctionActionsDropdown(props: {
  frame: FlamegraphFrame;
  organization: Organization;
  profileGroup: ProfileGroup;
}) {
  const {projects} = useProjects();
  const firstProfileReference = props.frame.profileIds?.[0];

  const projectsLookupTable = useMemo(() => {
    return projects.reduce(
      (acc, project) => {
        acc[parseInt(project.id, 10)] = project;
        return acc;
      },
      {} as Record<number, Project>
    );
  }, [projects]);

  const project =
    firstProfileReference &&
    typeof firstProfileReference !== 'string' &&
    'project_id' in firstProfileReference
      ? projectsLookupTable[firstProfileReference.project_id]
      : undefined;

  const sourceCodeLink = useSourceCodeLink({
    project,
    organization: props.organization,
    commitId: props.profileGroup?.metadata?.release?.lastCommit?.id,
    platform: props.profileGroup?.metadata?.platform || project?.platform,
    frame: {file: props.frame.frame.file, path: props.frame.frame.path},
  });

  const onOpenInGithubClick = useCallback(() => {
    if (!sourceCodeLink.isSuccess) {
      return;
    }

    if (
      !sourceCodeLink.data.sourceUrl ||
      sourceCodeLink.data.config?.provider?.key !== 'github'
    ) {
      return;
    }

    // make a best effort to link to the exact line if we can
    const url = props.frame.frame.line
      ? `${sourceCodeLink.data.sourceUrl}#L${props.frame.frame.line}`
      : sourceCodeLink.data.sourceUrl;

    window.open(url, '_blank', 'noopener,noreferrer');
  }, [props.frame, sourceCodeLink]);

  const onCopyFunctionName = useCallback(() => {
    navigator.clipboard
      .writeText(props.frame.frame.name)
      .then(() => {
        addSuccessMessage(t('Copied function name to clipboard'));
      })
      .catch(() => {
        addErrorMessage(t('Failed to copy function name to clipboard'));
      });
  }, [props.frame]);

  const onCopyFunctionSource = useCallback(() => {
    navigator.clipboard
      .writeText(props.frame.frame.getSourceLocation())
      .then(() => {
        addSuccessMessage(t('Copied function source to clipboard'));
      })
      .catch(() => {
        addErrorMessage(t('Failed to copy function source to clipboard'));
      });
  }, [props.frame]);

  return (
    <DropdownMenu
      trigger={triggerProps => (
        <AggregateFlamegraphFunctionActionsDropdownButtonWrapper>
          <Button aria-label={t('Actions')} size="xs" borderless {...triggerProps}>
            {'\u22EF'}
          </Button>
        </AggregateFlamegraphFunctionActionsDropdownButtonWrapper>
      )}
      position="bottom-end"
      items={[
        {
          key: 'copy-function-name',
          leadingItems: <IconCopy />,
          label: t('Copy Function Name'),
          disabled: !props.frame.frame.name,
          onAction: onCopyFunctionName,
        },
        {
          key: 'copy-function-source',
          leadingItems: <IconCopy />,
          label: t('Copy Source Location'),
          disabled: !props.frame.frame.file,
          onAction: onCopyFunctionSource,
        },
        {
          key: 'open-in-github',
          leadingItems: sourceCodeLink.isLoading ? (
            <SmallLoadingIndicator size={10} hideMessage />
          ) : (
            <IconGithub />
          ),
          label: t('Open in GitHub'),
          tooltip: sourceCodeLink.isSuccess
            ? undefined
            : sourceCodeLink.isError
              ? t('Failed to resolve source code location in Github')
              : undefined,
          disabled: !sourceCodeLink.isSuccess || !sourceCodeLink.data?.sourceUrl,
          onAction: onOpenInGithubClick,
        },
      ]}
    />
  );
}

// We need this because the styling is overriden by the dropdown menu
const AggregateFlamegraphFunctionActionsDropdownButtonWrapper = styled('span')`
  button {
    padding: ${space(0.25)} ${space(0.5)} !important;
    height: auto !important;
    min-height: auto !important;
  }
`;

const SmallLoadingIndicator = styled(LoadingIndicator)`
  margin: 0;
  transform: translateX(-2px);

  > div {
    border: 2px solid ${p => p.theme.gray100} !important;
    border-left-color: ${p => p.theme.gray200} !important;
  }
`;

function AggregateFlamegraphProfileReference(props: {
  frameName: string;
  framePackage: string | undefined;
  profile: Profiling.ProfileReference;
  projectLookupTable: Record<string, Project>;
}) {
  const organization = useOrganization();
  const project =
    typeof props.profile !== 'string' && 'project_id' in props.profile
      ? props.projectLookupTable[props.profile.project_id]
      : undefined;

  if (!project) {
    return null;
  }

  const to = generateProfileRouteFromProfileReference({
    organization,
    projectSlug: project.slug,
    reference: props.profile,
    frameName: props.frameName,
    framePackage: props.framePackage,
  });

  const reference =
    typeof props.profile === 'string'
      ? props.profile
      : 'profiler_id' in props.profile
        ? props.profile.profiler_id
        : props.profile.profile_id;

  return (
    <AggregateFlamegraphProfileReferenceContainer>
      <AggregateFlamegraphProfileReferenceProject>
        <ProjectAvatar project={project} />
        {project.name || project.slug}
      </AggregateFlamegraphProfileReferenceProject>
      <Link to={to}>
        <TextOverflow>{reference.substring(0, 8)}</TextOverflow>
        <IconOpen />
      </Link>
    </AggregateFlamegraphProfileReferenceContainer>
  );
}

const AggregateFlamegraphFunctionContainer = styled('div')`
  display: grid;
  grid-template-columns: 1fr min-content;
  gap: ${space(1)};

  &:not(:last-child) {
    margin-bottom: ${space(1)};
  }
`;

const AggregateFlamegraphFunctionName = styled('button')`
  font-size: ${p => p.theme.fontSizeMedium};
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
  text-align: left;
`;

const AggregateFlamegraphFunctionBreakdownContainer = styled('div')`
  flex-direction: column;
  width: 360px;
  border-left: 1px solid ${p => p.theme.border};
  overflow: scroll;
`;
const AggregateFlamegraphFunctionBreakdownHeaderRow = styled('div')<{
  fontSize?: string;
}>`
  display: flex;
  align-items: center;
  font-size: ${p => p.fontSize ?? p.theme.fontSizeSmall};
`;

const AggregateFlamegraphSourceRow = styled('div')``;

const AggregateFlamegraphFunctionNameRow = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: start;
  justify-content: space-between;
  min-width: 0;
  overflow: hidden;
`;

const AggregateFlamegraphFunctionSource = styled(
  AggregateFlamegraphFunctionBreakdownHeaderRow
)`
  color: ${p => p.theme.subText};
  margin-top: ${space(0.25)};
  font-size: ${p => p.theme.fontSizeSmall};
  min-width: 0;
  cursor: pointer;
  width: 100%;
`;

const AggregateFlamegraphFunctionSamples = styled(
  AggregateFlamegraphFunctionBreakdownHeaderRow
)`
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: space-between;
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  white-space: nowrap;
  line-height: 1.2;
`;

const AggregateFlamegraphProfileReferenceContainer = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-family: ${p => p.theme.text.family};
  gap: ${space(1)};

  &:not(:last-child) {
    margin-bottom: ${space(0.5)};
    padding: ${space(0.25)} 0;
  }

  a {
    display: flex;
    align-items: center;
    gap: ${space(0.5)};
    color: ${p => p.theme.textColor};
  }
`;

const AggregateFlamegraphProfileReferenceProject = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;

const AggregateFlamegraphSectionHeader = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  background-color: ${p => p.theme.backgroundSecondary};
  padding: ${space(0.5)} ${space(1)};
  border-bottom: 1px solid ${p => p.theme.border};
  text-transform: uppercase;
  font-weight: ${p => p.theme.fontWeightBold};

  &:not(:first-child) {
    border-top: 1px solid ${p => p.theme.border};
  }
`;

const AggregateFlamegraphSection = styled('div')`
  padding: ${space(1)};
`;

const AggregateFlamegraphFunctionBreakdownEmptyState = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: ${p => p.theme.subText};
  text-align: center;
`;

const AggregateFlamegraphFunctionBreakdownHeader = styled('div')`
  width: 100%;
`;

const AggregateFlamegraphCanvasContainer = styled('div')`
  display: grid;
  height: 100%;
  grid-template-columns: 1fr min-content;
`;

const AggregateFlamegraphSearch = styled(FlamegraphSearch)`
  max-width: 300px;
`;

const AggregateFlamegraphToolbarContainer = styled('div')`
  display: flex;
  justify-content: space-between;
  gap: ${space(1)};
  padding: ${space(1)} ${space(1)};
  /*
    force height to be the same as profile digest header,
    but subtract 1px for the border that doesnt exist on the header
   */
  height: 41px;
  border-bottom: 1px solid ${p => p.theme.border};
`;

const ViewSelectContainer = styled('div')`
  min-width: 160px;
`;

const RequestStateMessageContainer = styled('div')`
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  color: ${p => p.theme.subText};
`;

const AggregateFlamegraphContainer = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1 1 100%;
  height: 100%;
  width: 100%;
  overflow: hidden;
  position: absolute;
  left: 0px;
  top: 0px;
`;
