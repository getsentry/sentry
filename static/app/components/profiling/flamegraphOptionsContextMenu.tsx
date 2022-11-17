import {Fragment, useCallback, useEffect, useState} from 'react';

import {IconCopy, IconGithub} from 'sentry/icons';
import {t} from 'sentry/locale';
import {RequestState} from 'sentry/types';
import {StacktraceLinkResult} from 'sentry/types/integrations';
import {defined} from 'sentry/utils';
import {
  FlamegraphAxisOptions,
  FlamegraphColorCodings,
  FlamegraphSorting,
  FlamegraphViewOptions,
} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/reducers/flamegraphPreferences';
import {useFlamegraphPreferences} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphPreferences';
import {useDispatchFlamegraphState} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphState';
import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {useContextMenu} from 'sentry/utils/profiling/hooks/useContextMenu';
import {ProfileGroup} from 'sentry/utils/profiling/profile/importProfile';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

import {
  ProfilingContextMenu,
  ProfilingContextMenuGroup,
  ProfilingContextMenuHeading,
  ProfilingContextMenuItemButton,
  ProfilingContextMenuItemCheckbox,
  ProfilingContextMenuLayer,
} from './ProfilingContextMenu/profilingContextMenu';

const FLAMEGRAPH_COLOR_CODINGS: FlamegraphColorCodings = [
  'by symbol name',
  'by system / application',
  'by library',
  'by recursion',
  'by frequency',
];
const FLAMEGRAPH_VIEW_OPTIONS: FlamegraphViewOptions = ['top down', 'bottom up'];
const FLAMEGRAPH_SORTING_OPTIONS: FlamegraphSorting = ['left heavy', 'call order'];
const FLAMEGRAPH_AXIS_OPTIONS: FlamegraphAxisOptions = ['standalone', 'transaction'];

interface FlameGraphOptionsContextMenuProps {
  contextMenu: ReturnType<typeof useContextMenu>;
  hoveredNode: FlamegraphFrame | null;
  isHighlightingAllOccurences: boolean;
  onCopyFunctionNameClick: () => void;
  onHighlightAllOccurencesClick: () => void;
  profileGroup: ProfileGroup | null;
}

function isSupportedPlatformForGitHubLink(platform: string | undefined): boolean {
  if (platform === undefined) {
    return false;
  }

  return platform === 'node' || platform === 'python';
}

export function FlamegraphOptionsContextMenu(props: FlameGraphOptionsContextMenuProps) {
  const api = useApi();
  const {projects} = useProjects();
  const organization = useOrganization();

  const preferences = useFlamegraphPreferences();
  const dispatch = useDispatchFlamegraphState();

  const [githubLink, setGithubLinkState] = useState<RequestState<StacktraceLinkResult>>({
    type: 'initial',
  });

  useEffect(() => {
    if (!props.hoveredNode || !props.profileGroup) {
      return setGithubLinkState({type: 'initial'});
    }

    if (!isSupportedPlatformForGitHubLink(props.profileGroup.metadata.platform)) {
      return undefined;
    }

    const project = projects.find(
      p => p.id === String(props.profileGroup?.metadata?.projectID)
    );

    if (!project || !props.hoveredNode) {
      return undefined;
    }

    const metadata = props.profileGroup.metadata;
    const commitId = metadata.release?.lastCommit?.id;
    const platform = metadata.platform;

    const frame = props.hoveredNode.frame;

    setGithubLinkState({type: 'loading'});

    api
      .requestPromise(`/projects/${organization.slug}/${project.slug}/stacktrace-link/`, {
        query: {
          file: frame.file,
          platform,
          commitId,
          ...(frame.path && {absPath: frame.path}),
        },
      })
      .then(response => {
        setGithubLinkState({type: 'resolved', data: response});
      });

    return () => {
      api.clear();
    };
  }, [props.hoveredNode, api, projects, organization, props.profileGroup]);

  // @TODO: this only works for github right now, other providers will not work
  const onOpenInGithubClick = useCallback(() => {
    if (githubLink.type !== 'resolved') {
      return;
    }

    if (
      !githubLink.data.sourceUrl ||
      githubLink.data.config?.provider?.key !== 'github'
    ) {
      return;
    }

    // make a best effort to link to the exact line if we can
    const url =
      defined(props.hoveredNode) && defined(props.hoveredNode.frame.line)
        ? `${githubLink.data.sourceUrl}#L${props.hoveredNode.frame.line}`
        : githubLink.data.sourceUrl;

    window.open(url, '_blank', 'noopener,noreferrer');
  }, [props.hoveredNode, githubLink]);

  return props.contextMenu.open ? (
    <Fragment>
      <ProfilingContextMenuLayer onClick={() => props.contextMenu.setOpen(false)} />
      <ProfilingContextMenu
        {...props.contextMenu.getMenuProps()}
        style={{
          position: 'absolute',
          left: props.contextMenu.position?.left ?? -9999,
          top: props.contextMenu.position?.top ?? -9999,
          maxHeight: props.contextMenu.containerCoordinates?.height ?? 'auto',
        }}
      >
        {props.hoveredNode ? (
          <ProfilingContextMenuGroup>
            <ProfilingContextMenuHeading>{t('Frame')}</ProfilingContextMenuHeading>
            <ProfilingContextMenuItemCheckbox
              {...props.contextMenu.getMenuItemProps({
                onClick: props.onHighlightAllOccurencesClick,
              })}
              checked={props.isHighlightingAllOccurences}
            >
              {t('Highlight all occurrences')}
            </ProfilingContextMenuItemCheckbox>
            <ProfilingContextMenuItemButton
              {...props.contextMenu.getMenuItemProps({
                onClick: props.onCopyFunctionNameClick,
              })}
              icon={<IconCopy size="xs" />}
            >
              {t('Copy function name')}
            </ProfilingContextMenuItemButton>
            <ProfilingContextMenuItemButton
              disabled={
                githubLink.type !== 'resolved' ||
                !(githubLink.type === 'resolved' && githubLink.data.sourceUrl)
              }
              tooltip={
                !isSupportedPlatformForGitHubLink(props.profileGroup?.metadata?.platform)
                  ? t('Open in GitHub is not yet supported for this platform')
                  : githubLink.type === 'resolved' &&
                    (!githubLink.data.sourceUrl ||
                      githubLink.data.config?.provider?.key !== 'github')
                  ? t('Could not find source code location in GitHub')
                  : undefined
              }
              {...props.contextMenu.getMenuItemProps({
                onClick: onOpenInGithubClick,
              })}
              icon={<IconGithub size="xs" />}
            >
              {t('Open in GitHub')}
            </ProfilingContextMenuItemButton>
          </ProfilingContextMenuGroup>
        ) : null}
        <ProfilingContextMenuGroup>
          <ProfilingContextMenuHeading>{t('Color Coding')}</ProfilingContextMenuHeading>
          {FLAMEGRAPH_COLOR_CODINGS.map((coding, idx) => (
            <ProfilingContextMenuItemCheckbox
              key={idx}
              {...props.contextMenu.getMenuItemProps({
                onClick: () => dispatch({type: 'set color coding', payload: coding}),
              })}
              onClick={() => dispatch({type: 'set color coding', payload: coding})}
              checked={preferences.colorCoding === coding}
            >
              {coding}
            </ProfilingContextMenuItemCheckbox>
          ))}
        </ProfilingContextMenuGroup>
        <ProfilingContextMenuGroup>
          <ProfilingContextMenuHeading>{t('View')}</ProfilingContextMenuHeading>
          {FLAMEGRAPH_VIEW_OPTIONS.map((view, idx) => (
            <ProfilingContextMenuItemCheckbox
              key={idx}
              {...props.contextMenu.getMenuItemProps({
                onClick: () => dispatch({type: 'set view', payload: view}),
              })}
              onClick={() => dispatch({type: 'set view', payload: view})}
              checked={preferences.view === view}
            >
              {view}
            </ProfilingContextMenuItemCheckbox>
          ))}
        </ProfilingContextMenuGroup>
        <ProfilingContextMenuGroup>
          <ProfilingContextMenuHeading>{t('Sorting')}</ProfilingContextMenuHeading>
          {FLAMEGRAPH_SORTING_OPTIONS.map((sorting, idx) => (
            <ProfilingContextMenuItemCheckbox
              key={idx}
              {...props.contextMenu.getMenuItemProps({
                onClick: () => dispatch({type: 'set sorting', payload: sorting}),
              })}
              onClick={() => dispatch({type: 'set sorting', payload: sorting})}
              checked={preferences.sorting === sorting}
            >
              {sorting}
            </ProfilingContextMenuItemCheckbox>
          ))}
        </ProfilingContextMenuGroup>
        <ProfilingContextMenuGroup>
          <ProfilingContextMenuHeading>{t('X Axis')}</ProfilingContextMenuHeading>
          {FLAMEGRAPH_AXIS_OPTIONS.map((axis, idx) => (
            <ProfilingContextMenuItemCheckbox
              key={idx}
              {...props.contextMenu.getMenuItemProps({
                onClick: () => dispatch({type: 'set xAxis', payload: axis}),
              })}
              onClick={() => dispatch({type: 'set xAxis', payload: axis})}
              checked={preferences.xAxis === axis}
            >
              {axis}
            </ProfilingContextMenuItemCheckbox>
          ))}
        </ProfilingContextMenuGroup>
      </ProfilingContextMenu>
    </Fragment>
  ) : null;
}
