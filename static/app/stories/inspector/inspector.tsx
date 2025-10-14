import {Fragment, useCallback, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {usePopper} from 'react-popper';
import {css, useTheme} from '@emotion/react';
import color from 'color';
import {AnimatePresence} from 'framer-motion';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Tag} from 'sentry/components/core/badge/tag';
import {Flex, Stack} from 'sentry/components/core/layout';
import {Separator} from 'sentry/components/core/separator';
import {Text} from 'sentry/components/core/text';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Overlay} from 'sentry/components/overlay';
import {
  ProfilingContextMenu,
  ProfilingContextMenuGroup,
  ProfilingContextMenuHeading,
  ProfilingContextMenuItemButton,
} from 'sentry/components/profiling/profilingContextMenu';
import {NODE_ENV} from 'sentry/constants';
import {IconChevron, IconCopy, IconDocs, IconLink, IconOpen} from 'sentry/icons';
import {IconBot} from 'sentry/icons/iconBot';
import {t} from 'sentry/locale';
import {
  isMDXStory,
  useStoriesLoader,
  useStoryBookFiles,
} from 'sentry/stories/view/useStoriesLoader';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useContextMenu} from 'sentry/utils/profiling/hooks/useContextMenu';
import {useHotkeys} from 'sentry/utils/useHotkeys';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';

import {AIChat} from './ai-overlay';
import {
  getComponentName,
  getComponentStorybookFile,
  getSourcePath,
  getSourcePathFromMouseEvent,
  isCoreComponent,
  isTraceElement,
  isViewComponent,
  type TraceElement,
} from './componentTrace';

const CURSOR_OFFSET_RIGHT = 4;
const CURSOR_OFFSET_LEFT = 8;
const CURSOR_OFFSET_TOP = 8;
const CURSOR_OFFSET_BOTTOM = 4;

export function SentryComponentInspector() {
  const theme = useTheme();
  const tooltipRef = useRef<HTMLDivElement>(null);
  const contextMenuElementRef = useRef<HTMLDivElement>(null);
  const skipShowingTooltipRef = useRef<boolean>(false);

  const user: ReturnType<typeof useUser> | null = useUser();
  const organization = useOrganization({allowNull: true});

  const [state, setState] = useState<{
    enabled: null | 'inspector' | 'context-menu' | 'ai-assistant';
    trace: TraceElement[] | null;
  }>({
    enabled: null,
    trace: [],
  });

  useHotkeys([
    {
      match: 'command+i',
      callback: () => {
        if (NODE_ENV !== 'development' || !user?.isSuperuser) {
          return;
        }
        setState(prev => ({
          ...prev,
          enabled: prev.enabled === 'inspector' ? null : 'inspector',
        }));
      },
    },
  ]);

  const contextMenu = useContextMenu({container: tooltipRef.current});
  const [contextMenuTrace, setContextMenuTrace] = useState<TraceElement[] | null>(null);

  const tooltipPositionRef = useRef<{
    left: number;
    mouse: {x: number; y: number};
    top: number;
  } | null>(null);

  const contextMenuPositionRef = useRef<{
    left: number;
    top: number;
  } | null>(null);

  // Store the state in a ref to avoid re-rendering inside the listeners
  const stateRef = useRef(state);
  stateRef.current = state;

  useLayoutEffect(() => {
    if (!user || !user.isSuperuser || NODE_ENV !== 'development') {
      return () => {};
    }

    const onMouseMove = (event: MouseEvent & {preventTrace?: boolean}) => {
      window.requestAnimationFrame(() => {
        if (tooltipRef.current) {
          tooltipPositionRef.current = {
            ...computeTooltipPosition(event, tooltipRef.current),
            mouse: {
              x: event.clientX,
              y: event.clientY,
            },
          };
          tooltipRef.current.style.left = `${tooltipPositionRef.current.left}px`;
          tooltipRef.current.style.top = `${tooltipPositionRef.current.top}px`;
          if (skipShowingTooltipRef.current) {
            tooltipRef.current.style.opacity = '0';
          } else {
            tooltipRef.current.style.opacity = '1';
          }
          skipShowingTooltipRef.current = false;
        }

        if (
          isTraceElement(event.target) &&
          event.target.closest('[data-inspector-skip]')
        ) {
          return;
        }

        let trace = getSourcePathFromMouseEvent(event);
        if (trace?.[0] === stateRef.current.trace?.[0]) {
          return;
        }

        if (!trace) {
          document
            .querySelectorAll('[data-sentry-component-trace]')
            .forEach(el => delete (el as TraceElement).dataset.sentryComponentTrace);

          setState(prev => ({
            ...prev,
            trace: null,
          }));
          return;
        }

        // Find the common root, so that we only update the smallest subtree possible
        for (let i = 0; i < (trace?.length ?? 0); i++) {
          if (trace?.[i] !== stateRef.current.trace?.[i]) {
            trace = trace?.slice(i);
            break;
          }
        }

        const removeNodes = new Set<TraceElement>(
          document.querySelectorAll('[data-sentry-component-trace]')
        );

        for (const el of trace ?? []) {
          el.dataset.sentryComponentTrace = '1';
          removeNodes.delete(el);
        }

        for (const el of removeNodes) {
          delete el.dataset.sentryComponentTrace;
        }

        setState(prev => {
          return {
            ...prev,
            trace,
          };
        });
      });
    };

    const onInspectorToggle = () => {
      trackAnalytics('devtools.component_inspector_toggled', {
        organization,
        enabled: stateRef.current.enabled === null ? 'inspector' : null,
      });
      setState(prev => ({
        ...prev,
        enabled: stateRef.current.enabled === null ? 'inspector' : null,
      }));
    };

    const onScroll = () => {
      contextMenu.setOpen(false);

      tooltipPositionRef.current = null;
      contextMenuPositionRef.current = null;

      if (state.enabled === 'context-menu') {
        setState(prev => ({
          ...prev,
          enabled: 'inspector',
          trace: null,
        }));
      }
    };

    const onContextMenu = (event: MouseEvent) => {
      // Prevent built-in context menu from appearing
      event.preventDefault();

      setState(prev => ({
        ...prev,
        enabled: 'context-menu',
      }));

      contextMenu.handleContextMenu(event);

      setContextMenuTrace(stateRef.current.trace);
      contextMenuPositionRef.current = {
        left: tooltipPositionRef.current?.left ?? event.clientX,
        top: tooltipPositionRef.current?.top ?? event.clientY,
      };
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (stateRef.current.enabled === 'context-menu' && contextMenuElementRef.current) {
        // If the click is outside the context menu, we close it and go back to the inspector view
        if (
          !contextMenuElementRef.current.contains(event.target as Node) &&
          !contextMenu.subMenuRef.current?.contains(event.target as Node)
        ) {
          contextMenu.setOpen(false);
          setState(prev => ({
            ...prev,
            enabled: prev.enabled === 'context-menu' ? 'inspector' : null,
          }));
          // We are going to skip the tooltip from showing when the user clicks outside the context menu, so that
          // it will appear hidden until the next mousemove event is triggered.
          skipShowingTooltipRef.current = true;

          // Dispatch a synthetic mousemove event to ensure the mousemove listener
          // picks up the current mouse position when switching back to inspector mode and highlighting the components
          if (event.target) {
            const syntheticEvent = new MouseEvent('mousemove', {
              clientX: event.clientX,
              clientY: event.clientY,
              bubbles: true,
              cancelable: true,
            });
            // Dispatch the event on the actual target element, not document.body
            event.target.dispatchEvent(syntheticEvent);
          }
        }
      }
    };

    if (state.enabled) {
      document.body.addEventListener('contextmenu', onContextMenu);
      document.body.addEventListener('mousemove', onMouseMove);
      document.addEventListener('pointerdown', handleClickOutside);
    } else {
      document.body.removeEventListener('mousemove', onMouseMove);
      document.body.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('pointerdown', handleClickOutside);
    }

    window.addEventListener('devtools.toggle_component_inspector', onInspectorToggle);
    window.addEventListener('scroll', onScroll, {passive: true});

    return () => {
      window.removeEventListener(
        'devtools.toggle_component_inspector',
        onInspectorToggle
      );

      window.removeEventListener('scroll', onScroll);
      document.body.removeEventListener('contextmenu', onContextMenu);
      document.body.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('pointerdown', handleClickOutside);
    };
  }, [state.enabled, contextMenu, user, organization]);

  const tracePreview = useMemo(() => {
    return state.trace?.slice(0, 3) ?? [];
  }, [state.trace]);

  const {ref: contextMenuRef, ...contextMenuProps} = {...contextMenu.getMenuProps()};
  const positionContextMenuOnMountRef = useCallback(
    (ref: HTMLDivElement | null) => {
      contextMenuRef(ref);

      if (ref) {
        const position = computeTooltipPosition(
          {
            x: tooltipPositionRef.current?.mouse.x ?? 0,
            y: tooltipPositionRef.current?.mouse.y ?? 0,
          },
          ref
        );

        ref.style.left = `${position.left}px`;
        ref.style.top = `${position.top}px`;
      }
    },
    [contextMenuRef]
  );

  const storybookFiles = useStoryBookFiles();
  const storybookFilesLookup = useMemo(
    () =>
      storybookFiles.reduce(
        (acc, file) => {
          acc[file] = file;
          return acc;
        },
        {} as Record<string, string>
      ),
    [storybookFiles]
  );

  if (NODE_ENV !== 'development' || !user?.isSuperuser) {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {state.enabled === 'inspector' ? (
        <Overlay
          ref={tooltipRef}
          data-inspector-skip
          style={{
            position: 'fixed',
            backgroundColor: theme.tokens.background.primary,
            width: 'max-content',
            maxWidth: '460px',
          }}
        >
          <Flex direction="column" gap="xs" padding="md">
            <ProfilingContextMenuHeading style={{padding: '0'}}>
              {t('Hovered Components')}
            </ProfilingContextMenuHeading>
            {tracePreview.length === 0 ? (
              <Text size="md" ellipsis monospace>
                no component detected
              </Text>
            ) : (
              <Stack direction="column" gap="md">
                <Stack direction="column" gap="xs">
                  {tracePreview.map((el, index) => (
                    <Fragment key={index}>
                      <Flex direction="row" gap="xs" align="center" justify="between">
                        <Text size="sm" bold monospace>
                          {getComponentName(el)}
                        </Text>
                        <Flex direction="row" gap="xs" align="center">
                          {getComponentStorybookFile(el, storybookFilesLookup) ? (
                            <IconDocs size="xs" />
                          ) : null}
                          <ComponentTraceTag el={el} />
                        </Flex>
                      </Flex>
                      <Text size="xs" variant="muted" ellipsis monospace>
                        .../
                        {getSourcePath(el)}
                      </Text>
                    </Fragment>
                  ))}
                </Stack>
                {state.trace?.length && state.trace.length > tracePreview.length && (
                  <Fragment>
                    <Separator orientation="horizontal" border="primary" />
                    <Text size="xs" ellipsis monospace align="right" variant="muted">
                      context menu to view more, cmd+shift+c to close
                    </Text>
                  </Fragment>
                )}
              </Stack>
            )}
          </Flex>
        </Overlay>
      ) : state.enabled === 'context-menu' ? (
        <Fragment>
          <ProfilingContextMenu
            data-inspector-skip
            ref={ref => {
              contextMenuElementRef.current = ref;
              positionContextMenuOnMountRef(ref);
            }}
            {...contextMenuProps}
            style={{
              position: 'fixed',
              width: 'max-content',
            }}
          >
            <ProfilingContextMenuGroup>
              <Flex direction="column" gap="xs" padding="md xs">
                <Flex padding="0 xs">
                  <ProfilingContextMenuHeading style={{padding: '0'}}>
                    {t('Component Trace')}
                  </ProfilingContextMenuHeading>
                </Flex>
                {!contextMenuTrace || contextMenuTrace.length === 0
                  ? null
                  : contextMenuTrace.map((el, index) => {
                      const componentName = getComponentName(el);
                      const sourcePath = getSourcePath(el);

                      return (
                        <MenuItem
                          key={index}
                          contextMenu={contextMenu}
                          componentName={componentName}
                          sourcePath={sourcePath}
                          el={el}
                          storybook={getComponentStorybookFile(el, storybookFilesLookup)}
                          onAIAssistant={() => {
                            setState(prev => ({
                              ...prev,
                              enabled: 'ai-assistant',
                            }));
                          }}
                          onAction={() => {
                            contextMenu.setOpen(false);

                            setState(prev => ({
                              ...prev,
                              enabled: 'inspector',
                              trace: null,
                            }));
                          }}
                          subMenuPortalRef={contextMenu.subMenuRef.current}
                        />
                      );
                    })}
              </Flex>
            </ProfilingContextMenuGroup>
          </ProfilingContextMenu>
          <div
            ref={el => {
              contextMenu.subMenuRef.current = el;
            }}
            data-inspector-skip
            id="sub-menu-portal"
          />
        </Fragment>
      ) : state.enabled === 'ai-assistant' ? (
        <AIChat
          onClose={() => setState(prev => ({...prev, enabled: 'inspector'}))}
          onSubmit={() => {}}
        />
      ) : null}
      {state.enabled === null ? null : (
        <style>
          {`

          [data-inspector-skip] {
            z-index: 999999 !important;
          }

          .sentry-component-trace-tooltip * {
            box-shadow: unset !important;
          }

          [data-sentry-component-trace][data-sentry-source-path]:not([data-inspector-skip]) {
            box-shadow: 0 0 0 1px ${theme.tokens.border.success} !important;
            background-color: ${color(theme.tokens.border.success).fade(0.95).toString()} !important;
          }

          [data-sentry-component-trace][data-sentry-source-path*="app/components/core"]:not([data-inspector-skip]) {
            box-shadow: 0 0 0 1px ${theme.tokens.border.accent} !important;
            background-color: ${color(theme.tokens.border.accent).fade(0.6).toString()} !important;
          }

          [data-sentry-component-trace][data-sentry-source-path*="app/components/core"]:not([data-inspector-skip]) [data-sentry-source-path*="app/components/core"],
          [data-sentry-component-trace][data-sentry-source-path*="app/components/core"]:not([data-inspector-skip]) [data-sentry-source-path] {
            box-shadow: none !important;
          }
        `}
        </style>
      )}
    </AnimatePresence>,
    document.body
  );
}

function MenuItem(props: {
  componentName: string;
  contextMenu: ReturnType<typeof useContextMenu>;
  el: TraceElement;
  onAIAssistant: () => void;
  onAction: () => void;
  sourcePath: string;
  storybook: string | null;
  subMenuPortalRef: HTMLElement | null;
}) {
  const [isOpen, _setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const storyQuery = useStoriesLoader({
    files: props.storybook?.endsWith('.mdx') ? [props.storybook] : [],
  });

  const story = storyQuery.data?.[0];

  const figmaLink =
    story && isMDXStory(story) ? story.exports.frontmatter?.resources?.figma : null;

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

  const currentTarget = useRef<Node | null>(null);

  useLayoutEffect(() => {
    const listener = (e: MouseEvent) => {
      window.requestAnimationFrame(() => {
        currentTarget.current = e.target as Node;
        if (!currentTarget.current) {
          return;
        }

        if (
          !triggerRef.current?.contains(currentTarget.current) &&
          !props.subMenuPortalRef?.contains(currentTarget.current)
        ) {
          setIsOpen(false);
        }
      });
    };

    document.addEventListener('mouseover', listener);

    return () => {
      document.removeEventListener('mouseover', listener);
    };
  }, [props.subMenuPortalRef, setIsOpen]);

  return (
    <Fragment>
      <ProfilingContextMenuItemButton
        {...props.contextMenu.getMenuItemProps({
          ref: el => (triggerRef.current = el),
          onClick: () => {
            setIsOpen(true);
          },
        })}
        onMouseEnter={() => {
          setIsOpen(true);
        }}
        style={{
          width: '100%',
          overflow: 'hidden',
          padding: '0',
        }}
      >
        <Flex
          direction="row"
          align="center"
          justify="between"
          width="100%"
          overflow="hidden"
        >
          <Stack direction="column" gap="xs" overflow="hidden" width="100%">
            <Flex direction="row" gap="xs" align="center" justify="between" width="100%">
              <Text size="sm" monospace bold>
                {props.componentName}
              </Text>
              <Flex direction="row" gap="xs" align="center">
                {props.storybook ? <IconDocs size="xs" /> : null}
                <ComponentTraceTag el={props.el} />
              </Flex>
            </Flex>
            <Text size="xs" variant="muted" ellipsis align="left" monospace>
              .../{props.sourcePath}
            </Text>
          </Stack>
          <Flex align="center" justify="center" paddingLeft="md">
            <IconChevron direction="right" size="xs" />
          </Flex>
        </Flex>
      </ProfilingContextMenuItemButton>

      {/* Submenu with copy and AI actions */}
      {isOpen && props.subMenuPortalRef
        ? createPortal(
            <ProfilingContextMenu
              style={popper.styles.popper}
              css={css`
                max-height: 250px;
                z-index: 1000000 !important;
              `}
            >
              <ProfilingContextMenuGroup>
                <ProfilingContextMenuHeading>{t('Actions')}</ProfilingContextMenuHeading>
                {props.storybook ? (
                  <ProfilingContextMenuItemButton
                    {...props.contextMenu.getMenuItemProps({
                      onClick: () => {
                        window.open(`/stories/?name=${props.storybook}`, '_blank');
                        props.onAction();
                      },
                    })}
                    icon={<IconLink size="xs" />}
                  >
                    {t('View Storybook')}
                  </ProfilingContextMenuItemButton>
                ) : null}
                <ProfilingContextMenuItemButton
                  {...props.contextMenu.getMenuItemProps({
                    onClick: props.onAIAssistant,
                  })}
                  icon={<IconBot size="xs" />}
                >
                  {t('Edit with AI Assistant')}
                </ProfilingContextMenuItemButton>
                <ProfilingContextMenuItemButton
                  {...props.contextMenu.getMenuItemProps({
                    onClick: () => {
                      if (figmaLink) {
                        window.open(figmaLink, '_blank');
                        props.onAction();
                      }
                    },
                  })}
                  disabled={storyQuery.isLoading || !figmaLink}
                  icon={
                    storyQuery.isLoading ? (
                      <LoadingIndicator mini size={12} />
                    ) : (
                      <IconOpen size="xs" />
                    )
                  }
                >
                  {t('Open in Figma')}
                </ProfilingContextMenuItemButton>
                <ProfilingContextMenuItemButton
                  {...props.contextMenu.getMenuItemProps({
                    onClick: () => {
                      copyToClipboard(props.componentName);
                      addSuccessMessage(t('Component name copied to clipboard'));
                      props.onAction();
                    },
                  })}
                  icon={<IconCopy size="xs" />}
                >
                  {t('Copy Component Name')}
                </ProfilingContextMenuItemButton>
                <ProfilingContextMenuItemButton
                  {...props.contextMenu.getMenuItemProps({
                    onClick: () => {
                      copyToClipboard(props.sourcePath);
                      addSuccessMessage(t('Component path copied to clipboard'));
                      props.onAction();
                    },
                  })}
                  icon={<IconCopy size="xs" />}
                >
                  {t('Copy Component Path')}
                </ProfilingContextMenuItemButton>
              </ProfilingContextMenuGroup>
            </ProfilingContextMenu>,
            props.subMenuPortalRef
          )
        : null}
    </Fragment>
  );
}

function ComponentTraceTag({el}: {el: TraceElement}) {
  if (isCoreComponent(el)) {
    return (
      <Tag type="success">
        <Text size="sm" monospace>
          CORE
        </Text>
      </Tag>
    );
  }

  if (isViewComponent(el)) {
    return (
      <Tag type="highlight">
        <Text size="sm" monospace>
          VIEW
        </Text>
      </Tag>
    );
  }

  return (
    <Tag type="warning">
      <Text size="sm" monospace>
        SHARED
      </Text>
    </Tag>
  );
}

function computeTooltipPosition(
  {x, y}: {x: number; y: number},
  container: HTMLDivElement
): {left: number; top: number} {
  const {innerWidth, innerHeight} = window;
  let top = y + CURSOR_OFFSET_TOP;
  let left = x + CURSOR_OFFSET_LEFT;

  if (x > innerWidth * 0.7) {
    left = x - (container.offsetWidth || 0) - CURSOR_OFFSET_RIGHT;
  }
  if (y > innerHeight * 0.7) {
    top = y - (container.offsetHeight || 0) - CURSOR_OFFSET_BOTTOM;
  }

  return {
    left,
    top,
  };
}

function copyToClipboard(text: string) {
  navigator.clipboard?.writeText(text).catch(() => {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
  });
}
