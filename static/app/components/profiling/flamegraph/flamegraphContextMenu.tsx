import {Fragment, useCallback, useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';

import Link from 'sentry/components/links/link';
import {Flex} from 'sentry/components/profiling/flex';
import {
  ProfilingContextMenu,
  ProfilingContextMenuGroup,
  ProfilingContextMenuHeading,
  ProfilingContextMenuItemButton,
  ProfilingContextMenuItemCheckbox,
  ProfilingContextMenuLayer,
} from 'sentry/components/profiling/profilingContextMenu';
import {IconChevron, IconCopy, IconGithub, IconProfiling} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {RequestState} from 'sentry/types';
import {StacktraceLinkResult} from 'sentry/types/integrations';
import {defined} from 'sentry/utils';
import {getShortEventId} from 'sentry/utils/events';
import {
  FlamegraphColorCodings,
  FlamegraphSorting,
  FlamegraphViewOptions,
} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/reducers/flamegraphPreferences';
import {useFlamegraphPreferences} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphPreferences';
import {useDispatchFlamegraphState} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphState';
import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {useContextMenu} from 'sentry/utils/profiling/hooks/useContextMenu';
import {ProfileGroup} from 'sentry/utils/profiling/profile/importProfile';
import {
  generateProfileFlamechartRoute,
  generateProfileFlamechartRouteWithHighlightFrame,
} from 'sentry/utils/profiling/routes';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

const FLAMEGRAPH_COLOR_CODINGS: FlamegraphColorCodings = [
  'by system vs application frame',
  'by system frame',
  'by application frame',
  'by symbol name',
  'by library',
  'by recursion',
  'by frequency',
];
const FLAMEGRAPH_VIEW_OPTIONS: FlamegraphViewOptions[] = ['top down', 'bottom up'];
const FLAMEGRAPH_SORTING_OPTIONS: FlamegraphSorting[] = [
  'call order',
  'alphabetical',
  'left heavy',
];

interface FlamegraphContextMenuProps {
  contextMenu: ReturnType<typeof useContextMenu>;
  hoveredNode: FlamegraphFrame | null;
  isHighlightingAllOccurences: boolean;
  onCopyFunctionNameClick: () => void;
  onHighlightAllOccurencesClick: () => void;
  profileGroup: ProfileGroup | null;
  disableCallOrderSort?: boolean;
}

function isSupportedPlatformForGitHubLink(platform: string | undefined): boolean {
  if (platform === undefined) {
    return false;
  }

  return platform === 'node' || platform === 'python';
}

export function FlamegraphContextMenu(props: FlamegraphContextMenuProps) {
  const api = useApi();
  const {projects} = useProjects();
  const organization = useOrganization();
  const preferences = useFlamegraphPreferences();
  const dispatch = useDispatchFlamegraphState();
  const subMenuPortalRef = useRef<HTMLDivElement | null>(null);

  const [githubLink, setGithubLinkState] = useState<RequestState<StacktraceLinkResult>>({
    type: 'initial',
  });

  const project = projects.find(
    p => p.id === String(props.profileGroup?.metadata?.projectID)
  );

  useEffect(() => {
    if (!props.hoveredNode || !props.profileGroup) {
      return setGithubLinkState({type: 'initial'});
    }

    if (!isSupportedPlatformForGitHubLink(props.profileGroup.metadata.platform)) {
      return undefined;
    }

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
  }, [props.hoveredNode, api, project, organization, props.profileGroup]);

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
            {props.hoveredNode.profileIds && (
              <ProfileIdsSubMenu
                contextMenu={props.contextMenu}
                profileIds={props.hoveredNode.profileIds}
                frameName={props.hoveredNode.frame.name}
                framePackage={props.hoveredNode.frame.image}
                organizationSlug={organization.slug}
                projectSlug={project?.slug}
                subMenuPortalRef={subMenuPortalRef.current}
              />
            )}
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
                onClick: () => {
                  props.onCopyFunctionNameClick();
                  // This is a button, so close the context menu.
                  props.contextMenu.setOpen(false);
                },
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
          {FLAMEGRAPH_SORTING_OPTIONS.map((sorting, idx) => {
            if (props.disableCallOrderSort && sorting === 'call order') {
              return null;
            }
            return (
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
            );
          })}
        </ProfilingContextMenuGroup>
      </ProfilingContextMenu>
      <div ref={el => (subMenuPortalRef.current = el)} id="sub-menu-portal" />
    </Fragment>
  ) : null;
}

function ProfileIdsSubMenu(props: {
  contextMenu: FlamegraphContextMenuProps['contextMenu'];
  frameName: string;
  framePackage: string | undefined;
  organizationSlug: string;
  profileIds: string[];
  projectSlug: string | undefined;
  subMenuPortalRef: HTMLElement | null;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const generateFlamechartLink = useCallback(
    (profileId: string) => {
      // this case should never happen
      if (!props.projectSlug) {
        return {};
      }

      if (props.framePackage) {
        return generateProfileFlamechartRouteWithHighlightFrame({
          orgSlug: props.organizationSlug,
          projectSlug: props.projectSlug,
          profileId,
          frameName: props.frameName,
          framePackage: props.framePackage,
        });
      }

      return generateProfileFlamechartRoute({
        orgSlug: props.organizationSlug,
        projectSlug: props.projectSlug,
        profileId,
      });
    },
    [props.frameName, props.framePackage, props.organizationSlug, props.projectSlug]
  );

  return (
    <Fragment>
      <ProfilingContextMenuItemButton
        icon={<IconProfiling size="xs" />}
        {...props.contextMenu.getMenuItemProps({
          onClick: () => setIsOpen(v => !v),
        })}
      >
        <Flex w="100%" justify="space-between" align="center">
          <Flex.Item>{t('Appears in %s profiles', props.profileIds.length)} </Flex.Item>
          <IconChevron direction={isOpen ? 'up' : 'down'} size="xs" />
        </Flex>
      </ProfilingContextMenuItemButton>
      {isOpen && (
        <ProfilingContextMenuInnerSubMenu>
          {props.profileIds.map(profileId => {
            const to = generateFlamechartLink(profileId);
            return (
              <ProfilingContextMenuInnerSubMenuItemButton
                key={profileId}
                {...props.contextMenu.getMenuItemProps()}
              >
                <Link to={to} css={{color: 'unset'}}>
                  {getShortEventId(profileId)} <IconChevron direction="right" size="xs" />
                </Link>
              </ProfilingContextMenuInnerSubMenuItemButton>
            );
          })}
        </ProfilingContextMenuInnerSubMenu>
      )}
    </Fragment>
  );
}

const ProfilingContextMenuInnerSubMenu = styled('div')`
  background: ${p => p.theme.backgroundSecondary};
`;

const ProfilingContextMenuInnerSubMenuItemButton = styled(ProfilingContextMenuItemButton)`
  border-bottom: 1px solid ${p => p.theme.surface100};
  padding-left: ${space(4)};
  padding-right: ${space(4)};
`;
