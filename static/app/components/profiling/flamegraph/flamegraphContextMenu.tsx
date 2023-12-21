import {Fragment, useCallback, useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {usePopper} from 'react-popper';
import styled from '@emotion/styled';

import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
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
import {useSourceCodeLink} from 'sentry/utils/profiling/hooks/useSourceLink';
import {ProfileGroup} from 'sentry/utils/profiling/profile/importProfile';
import {generateProfileFlamechartRouteWithHighlightFrame} from 'sentry/utils/profiling/routes';
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

const DIFFERENTIAL_FLAMEGRAPH_SORTING_OPTIONS: FlamegraphSorting[] = [
  'alphabetical',
  'left heavy',
];

const DIFFERENTIAL_FLAMEGRAPH_FRAME_OPTIONS = ['all', 'application', 'system'] as const;

interface FlamegraphContextMenuProps {
  contextMenu: ReturnType<typeof useContextMenu>;
  hoveredNode: FlamegraphFrame | null;
  isHighlightingAllOccurrences: boolean;
  onCopyFunctionNameClick: () => void;
  onCopyFunctionSource: () => void;
  onHighlightAllOccurrencesClick: () => void;
  profileGroup: ProfileGroup | null;
  disableCallOrderSort?: boolean;
  disableColorCoding?: boolean;
}

function isSupportedPlatformForGitHubLink(platform: string | undefined): boolean {
  if (platform === undefined) {
    return false;
  }

  return platform.includes('javascript') || platform === 'node' || platform === 'python';
}

export function FlamegraphContextMenu(props: FlamegraphContextMenuProps) {
  const {projects} = useProjects();
  const organization = useOrganization();
  const preferences = useFlamegraphPreferences();
  const dispatch = useDispatchFlamegraphState();

  const project = projects.find(
    p => p.id === String(props.profileGroup?.metadata?.projectID)
  );

  const sourceCodeLink = useSourceCodeLink({
    project,
    organization,
    commitId: props.profileGroup?.metadata?.release?.lastCommit?.id,
    platform: props.profileGroup?.metadata?.platform,
    frame: {file: props.hoveredNode?.frame.file, path: props.hoveredNode?.frame.path},
  });

  // @TODO: this only works for github right now, other providers will not work
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
    const url =
      defined(props.hoveredNode) && defined(props.hoveredNode.frame.line)
        ? `${sourceCodeLink.data.sourceUrl}#L${props.hoveredNode.frame.line}`
        : sourceCodeLink.data.sourceUrl;

    window.open(url, '_blank', 'noopener,noreferrer');
  }, [props.hoveredNode, sourceCodeLink]);

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
                framePackage={props.hoveredNode.frame.package}
                organizationSlug={organization.slug}
                projectSlug={project?.slug}
                subMenuPortalRef={props.contextMenu.subMenuRef.current}
              />
            )}
            <ProfilingContextMenuItemCheckbox
              {...props.contextMenu.getMenuItemProps({
                onClick: props.onHighlightAllOccurrencesClick,
              })}
              checked={props.isHighlightingAllOccurrences}
            >
              {t('Highlight all occurrences')}
            </ProfilingContextMenuItemCheckbox>

            <ProfilingContextMenuItemButton
              disabled={!(props.hoveredNode.frame.file ?? props.hoveredNode.frame.path)}
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
              {...props.contextMenu.getMenuItemProps({
                onClick: () => {
                  props.onCopyFunctionSource();
                  // This is a button, so close the context menu.
                  props.contextMenu.setOpen(false);
                },
              })}
              icon={<IconCopy size="xs" />}
            >
              {t('Copy source location')}
            </ProfilingContextMenuItemButton>
            <ProfilingContextMenuItemButton
              disabled={!sourceCodeLink.isSuccess || !sourceCodeLink.data?.sourceUrl}
              tooltip={
                !isSupportedPlatformForGitHubLink(props.profileGroup?.metadata?.platform)
                  ? t('Open in GitHub is not supported for this platform')
                  : sourceCodeLink.isLoading
                  ? 'Resolving link'
                  : sourceCodeLink.isSuccess &&
                    (!sourceCodeLink.data.sourceUrl ||
                      sourceCodeLink.data.config?.provider?.key !== 'github')
                  ? t('Could not find source code location in GitHub')
                  : undefined
              }
              {...props.contextMenu.getMenuItemProps({
                onClick: onOpenInGithubClick,
              })}
              icon={
                sourceCodeLink.isLoading ? (
                  <StyledLoadingIndicator size={10} hideMessage />
                ) : (
                  <IconGithub size="xs" />
                )
              }
            >
              {t('Open in GitHub')}
            </ProfilingContextMenuItemButton>
          </ProfilingContextMenuGroup>
        ) : null}
        {props.disableColorCoding ? null : (
          <ProfilingContextMenuGroup>
            <ProfilingContextMenuHeading>{t('Color Coding')}</ProfilingContextMenuHeading>
            {FLAMEGRAPH_COLOR_CODINGS.map((coding, idx) => (
              <ProfilingContextMenuItemCheckbox
                key={idx}
                {...props.contextMenu.getMenuItemProps({
                  onClick: () => dispatch({type: 'set color coding', payload: coding}),
                })}
                checked={preferences.colorCoding === coding}
              >
                {coding}
              </ProfilingContextMenuItemCheckbox>
            ))}
          </ProfilingContextMenuGroup>
        )}
        <ProfilingContextMenuGroup>
          <ProfilingContextMenuHeading>{t('View')}</ProfilingContextMenuHeading>
          {FLAMEGRAPH_VIEW_OPTIONS.map((view, idx) => (
            <ProfilingContextMenuItemCheckbox
              key={idx}
              {...props.contextMenu.getMenuItemProps({
                onClick: () => dispatch({type: 'set view', payload: view}),
              })}
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
                checked={preferences.sorting === sorting}
              >
                {sorting}
              </ProfilingContextMenuItemCheckbox>
            );
          })}
        </ProfilingContextMenuGroup>
      </ProfilingContextMenu>
      <div ref={el => (props.contextMenu.subMenuRef.current = el)} id="sub-menu-portal" />
    </Fragment>
  ) : null;
}

interface DifferentialFlamegraphMenuProps {
  contextMenu: ReturnType<typeof useContextMenu>;
  frameFilter: 'application' | 'system' | 'all';
  onClose: () => void;
  onFrameFilterChange: (type: 'application' | 'system' | 'all') => void;
}
export function DifferentialFlamegraphMenu(props: DifferentialFlamegraphMenuProps) {
  const preferences = useFlamegraphPreferences();
  const dispatch = useDispatchFlamegraphState();

  return (
    <ProfilingContextMenu>
      <ProfilingContextMenuGroup>
        <ProfilingContextMenuHeading>{t('Functions')}</ProfilingContextMenuHeading>
        {DIFFERENTIAL_FLAMEGRAPH_FRAME_OPTIONS.map((filter, idx) => (
          <ProfilingContextMenuItemCheckbox
            key={idx}
            {...props.contextMenu.getMenuItemProps({
              onClick: () => props.onFrameFilterChange(filter),
            })}
            checked={props.frameFilter === filter}
          >
            {filter === 'all'
              ? t('All frames')
              : filter === 'application'
              ? t('Application frames')
              : t('System frames')}
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
            checked={preferences.view === view}
          >
            {view}
          </ProfilingContextMenuItemCheckbox>
        ))}
      </ProfilingContextMenuGroup>
      <ProfilingContextMenuGroup>
        <ProfilingContextMenuHeading>{t('Sorting')}</ProfilingContextMenuHeading>
        {DIFFERENTIAL_FLAMEGRAPH_SORTING_OPTIONS.map((sorting, idx) => {
          return (
            <ProfilingContextMenuItemCheckbox
              key={idx}
              {...props.contextMenu.getMenuItemProps({
                onClick: () => dispatch({type: 'set sorting', payload: sorting}),
              })}
              checked={preferences.sorting === sorting}
            >
              {sorting}
            </ProfilingContextMenuItemCheckbox>
          );
        })}
      </ProfilingContextMenuGroup>
    </ProfilingContextMenu>
  );
}

const StyledLoadingIndicator = styled(LoadingIndicator)`
  margin: 0;
  transform: translateX(-2px);

  > div {
    border: 2px solid ${p => p.theme.gray100} !important;
    border-left-color: ${p => p.theme.gray200} !important;
  }
`;

function ProfileIdsSubMenu(props: {
  contextMenu: FlamegraphContextMenuProps['contextMenu'];
  frameName: string;
  framePackage: string | undefined;
  organizationSlug: string;
  profileIds: string[];
  projectSlug: string | undefined;
  subMenuPortalRef: HTMLElement | null;
}) {
  const [isOpen, _setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popper = usePopper(triggerRef.current, props.subMenuPortalRef, {
    placement: 'right-start',
    modifiers: [
      {
        name: 'offset',
        options: {
          offset: [-16, 0],
        },
      },
    ],
  });

  const setIsOpen: typeof _setIsOpen = useCallback(
    nextState => {
      _setIsOpen(nextState);
      popper.update?.();
    },
    [popper]
  );

  const currentTarget = useRef<Node | null>();
  useEffect(() => {
    const listener = (e: MouseEvent) => {
      currentTarget.current = e.target as Node;
      setTimeout(() => {
        if (!currentTarget.current) {
          return;
        }
        if (
          !triggerRef.current?.contains(currentTarget.current) &&
          !props.subMenuPortalRef?.contains(currentTarget.current)
        ) {
          setIsOpen(false);
        }
      }, 250);
    };
    document.addEventListener('mouseover', listener);
    return () => {
      document.removeEventListener('mouseover', listener);
    };
  }, [props.subMenuPortalRef, setIsOpen]);

  const generateFlamechartLink = useCallback(
    (profileId: string) => {
      // this case should never happen
      if (!props.projectSlug) {
        return {};
      }

      return generateProfileFlamechartRouteWithHighlightFrame({
        orgSlug: props.organizationSlug,
        projectSlug: props.projectSlug,
        profileId,
        frameName: props.frameName,
        framePackage: props.framePackage,
      });
    },
    [props.frameName, props.framePackage, props.organizationSlug, props.projectSlug]
  );

  return (
    <Fragment>
      <ProfilingContextMenuItemButton
        icon={<IconProfiling size="xs" />}
        {...props.contextMenu.getMenuItemProps({
          onClick: () => {
            setIsOpen(true);
          },
          ref: el => (triggerRef.current = el),
        })}
        onMouseEnter={() => {
          setIsOpen(true);
        }}
      >
        <Flex w="100%" justify="space-between" align="center">
          <Flex.Item>{t('Appears in %s profiles', props.profileIds.length)}</Flex.Item>
          <IconChevron direction="right" size="xs" />
        </Flex>
      </ProfilingContextMenuItemButton>
      {isOpen &&
        props.subMenuPortalRef &&
        createPortal(
          <ProfilingContextMenu style={popper.styles.popper} css={{maxHeight: 250}}>
            <ProfilingContextMenuGroup>
              <ProfilingContextMenuHeading>{t('Profiles')}</ProfilingContextMenuHeading>
              {props.profileIds.map(profileId => {
                const to = generateFlamechartLink(profileId);
                return (
                  <ProfilingContextMenuItemButton
                    key={profileId}
                    {...props.contextMenu.getMenuItemProps({})}
                  >
                    <Link to={to} css={{color: 'unset'}}>
                      {getShortEventId(profileId)}{' '}
                    </Link>
                  </ProfilingContextMenuItemButton>
                );
              })}
            </ProfilingContextMenuGroup>
          </ProfilingContextMenu>,
          props.subMenuPortalRef
        )}
    </Fragment>
  );
}
