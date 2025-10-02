import {Fragment, useCallback, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {usePopper} from 'react-popper';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import color from 'color';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Tag} from 'sentry/components/core/badge/tag';
import {Button} from 'sentry/components/core/button';
import {InputGroup} from 'sentry/components/core/input/inputGroup';
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
import {
  IconChevron,
  IconCopy,
  IconDocs,
  IconLink,
  IconOpen,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import {
  isMDXStory,
  useStoriesLoader,
  useStoryBookFiles,
} from 'sentry/stories/view/useStoriesLoader';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useContextMenu} from 'sentry/utils/profiling/hooks/useContextMenu';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';

type TraceElement = HTMLElement | SVGElement;

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

  // AI-related state
  const [aiInputVisible, setAiInputVisible] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [selectedComponent, setSelectedComponent] = useState<{
    name: string;
    sourcePath: string;
    trace: TraceElement[];
  } | null>(null);
  const [claudeConnection, setClaudeConnection] = useState<{
    connected: boolean;
    sessionId: string | null;
    ws: WebSocket | null;
  }>({connected: false, sessionId: null, ws: null});
  const [aiResponse, setAiResponse] = useState<string>('');
  const [isClaudeProcessing, setIsClaudeProcessing] = useState(false);

  // AI functionality handlers
  const connectToClaude = useCallback(() => {
    console.log('[Claude Connection] Attempting to connect...');
    setClaudeConnection(prevConnection => {
      console.log('[Claude Connection] Previous connection state:', prevConnection);

      if (prevConnection.connected && prevConnection.ws) {
        console.log('[Claude Connection] Already connected, reusing connection');
        return prevConnection;
      }

      console.log('[Claude Connection] Creating new WebSocket connection to ws://localhost:8080');
      const ws = new WebSocket('ws://localhost:8080');

      ws.onopen = () => {
        // eslint-disable-next-line no-console
        console.log('[Claude Connection] ✓ WebSocket connection opened successfully');
        setClaudeConnection(prev => ({...prev, connected: true}));
      };

      ws.onmessage = event => {
        // eslint-disable-next-line no-console
        console.log('[WebSocket] Raw message received:', event.data);

        try {
          // Check if this is a session_info message from our WebSocket server
          const parsed = JSON.parse(event.data);
          // eslint-disable-next-line no-console
          console.log('[WebSocket] Parsed message:', parsed);

          if (parsed.type === 'session_info' && parsed.session_id) {
            // eslint-disable-next-line no-console
            console.log('[WebSocket] Received Claude session ID:', parsed.session_id);
            setClaudeConnection(prev => {
              const updated = {
                ...prev,
                sessionId: parsed.session_id
              };
              // eslint-disable-next-line no-console
              console.log('[WebSocket] Updated connection state:', updated);
              return updated;
            });
            return; // Don't append this to the AI response
          }

          // Check if Claude is done processing (stream-json format sends a message with type: 'done')
          if (parsed.type === 'done' || parsed.type === 'assistant_message_done') {
            // eslint-disable-next-line no-console
            console.log('[WebSocket] Claude processing completed');
            setIsClaudeProcessing(false);
            return;
          }
        } catch (error) {
          // eslint-disable-next-line no-console
          console.log('[WebSocket] Not JSON, treating as response data:', error);
        }

        setAiResponse(prev => prev + event.data);
      };

      ws.onclose = event => {
        // eslint-disable-next-line no-console
        console.log('[Claude Connection] ✗ WebSocket connection closed', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean
        });
        setClaudeConnection(prev => ({...prev, connected: false, sessionId: null}));
      };

      ws.onerror = error => {
        // eslint-disable-next-line no-console
        console.error('[Claude Connection] ✗ WebSocket error:', error);
        console.error('[Claude Connection] Error details:', {
          type: error.type,
          target: error.target
        });
        setClaudeConnection(prev => ({...prev, connected: false}));
      };

      const newConnection = {ws, sessionId: prevConnection.sessionId, connected: false};
      console.log('[Claude Connection] Returning new connection state:', newConnection);
      return newConnection;
    });
  }, []);

  const handleModifyWithAI = useCallback(
    (el: TraceElement, componentName: string, sourcePath: string) => {
      // Get the full component trace
      const trace = getFullTrace(el);

      setSelectedComponent({name: componentName, sourcePath, trace});
      setAiInputVisible(true);
      connectToClaude();
    },
    [connectToClaude]
  );

  const sendAiPrompt = useCallback(() => {
    if (!aiPrompt.trim()) return;

    setIsClaudeProcessing(true);

    setSelectedComponent(currentComponent => {
      if (!currentComponent) return currentComponent;

      setClaudeConnection(prevConnection => {
        if (!prevConnection.ws) return prevConnection;

        const traceContext = currentComponent.trace.map(el => ({
          component: getComponentName(el),
          path: getSourcePath(el),
        }));

        const message = {
          prompt: aiPrompt,
          component: {
            name: currentComponent.name,
            path: currentComponent.sourcePath,
            trace: traceContext,
          },
        };

        console.log('[AI] Sending prompt:', message);
        prevConnection.ws.send(JSON.stringify(message));
        return prevConnection;
      });

      return currentComponent;
    });

    setAiResponse('');
    setAiPrompt('');
  }, [aiPrompt]);

  const [state, setState] = useState<{
    enabled: null | 'inspector' | 'context-menu' | 'ai-input';
    trace: TraceElement[] | null;
  }>({
    enabled: null,
    trace: [],
  });

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

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    });
  }, []);

  const copyClaudeSessionCommand = useCallback(() => {
    // eslint-disable-next-line no-console
    console.log('[Copy] Full connection state:', claudeConnection);
    // eslint-disable-next-line no-console
    console.log('[Copy] Session ID:', claudeConnection.sessionId);
    const sessionIdPart = claudeConnection.sessionId
      ? ` --session-id ${claudeConnection.sessionId}`
      : '';
    const command = `claude -p --output-format stream-json --input-format stream-json --verbose${sessionIdPart}`;
    // eslint-disable-next-line no-console
    console.log('[Copy] Command to copy:', command);
    copyToClipboard(command);
    addSuccessMessage(t('Claude session command copied to clipboard'));
  }, [copyToClipboard, claudeConnection]);

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
    <Fragment>
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
                          <ComponentTag el={el} />
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
      ) : state.enabled === 'context-menu' && contextMenu.open ? (
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
                          onAction={() => {
                            contextMenu.setOpen(false);
                            setState(prev => ({
                              ...prev,
                              enabled: 'inspector',
                              trace: null,
                            }));
                          }}
                          copyToClipboard={copyToClipboard}
                          subMenuPortalRef={contextMenu.subMenuRef.current}
                          handleModifyWithAI={handleModifyWithAI}
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
      ) : null}
      {state.enabled === 'context-menu' || state.enabled === 'inspector' ? (
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
      ) : null}
      {aiInputVisible ? (
        <FloatingInputContainer data-inspector-skip>
          <FloatingInputWrapper>
            {selectedComponent && (
              <Flex direction="row" justify="between" align="center" gap="xs" marginBottom="md">
                <Flex flex="1" direction="row" align="center" gap="xs">
                  <LoadingIndicatorWrapper $isProcessing={isClaudeProcessing}>
                    <LoadingIndicator mini size={12} />
                  </LoadingIndicatorWrapper>
                  <Text size="xs" monospace>
                    {selectedComponent.name} {selectedComponent.sourcePath}
                  </Text>
                </Flex>
                {claudeConnection.sessionId && (
                  <Button
                    size="xs"
                    priority="link"
                    onClick={copyClaudeSessionCommand}
                  >
                    <Flex gap="xs" align="center">
                      Session: {claudeConnection.sessionId.substring(0, 8)}...
                      <IconCopy size="xs" />
                    </Flex>
                  </Button>
                )}
              </Flex>
            )}
            <InputGroup>
              <InputGroup.Input
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                placeholder="Describe changes to make to this component..."
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendAiPrompt();
                  }
                }}
              />
              <InputGroup.TrailingItems>
                <Button
                  size="xs"
                  priority="default"
                  onClick={() => setAiInputVisible(false)}
                  aria-label="Close AI input"
                >
                  Close
                </Button>
                <Button
                  size="xs"
                  priority="primary"
                  onClick={sendAiPrompt}
                  disabled={!aiPrompt.trim()}
                  aria-label="Send to Claude"
                >
                  Send
                </Button>
              </InputGroup.TrailingItems>
            </InputGroup>
          </FloatingInputWrapper>
        </FloatingInputContainer>
      ) : null}
    </Fragment>,
    document.body
  );
}

// Helper function to get full component trace
function getFullTrace(el: TraceElement): TraceElement[] {
  const trace: TraceElement[] = [el];
  let parent = el.parentElement;

  while (parent) {
    const next = parent.closest('[data-sentry-source-path]') as TraceElement | null;
    if (!next || next === parent) break;
    trace.push(next);
    parent = next.parentElement;
  }

  return trace;
}

// Styled components for AI input
const FloatingInputContainer = styled('div')`
  position: fixed;
  bottom: ${space(2)};
  left: 50%;
  transform: translateX(-50%);
  width: 90%;
  max-width: 800px;
  z-index: 999999;
`;

const FloatingInputWrapper = styled('div')`
  position: relative;
  background: ${p => p.theme.backgroundElevated};
  border: 1px solid ${p => p.theme.border};
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  padding: ${space(1)};
`;

const LoadingIndicatorWrapper = styled('div')<{$isProcessing: boolean}>`
  opacity: ${p => (p.$isProcessing ? 1 : 0)};
  transition: opacity 0.2s ease-in-out;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 12px;
  height: 12px;
  position: relative;
  flex-shrink: 0;
`;


const AiResponseContainer = styled('div')`
  margin-top: ${space(2)};
  padding: ${space(2)};
  background: ${p => p.theme.backgroundSecondary};
  border-radius: 4px;
  max-height: 300px;
  overflow-y: auto;

  pre {
    white-space: pre-wrap;
    margin: ${space(1)} 0 0 0;
    font-family: monospace;
    font-size: 12px;
  }
`;

function MenuItem(props: {
  componentName: string;
  contextMenu: ReturnType<typeof useContextMenu>;
  copyToClipboard: (text: string) => void;
  el: TraceElement;
  handleModifyWithAI: (
    el: TraceElement,
    componentName: string,
    sourcePath: string
  ) => void;
  onAction: () => void;
  sourcePath: string;
  storybook: string | null;
  subMenuPortalRef: HTMLElement | null;
}) {
  // Load story to check for Figma link if it's an MDX file
  const storyQuery = useStoriesLoader({
    files: props.storybook?.endsWith('.mdx') ? [props.storybook] : [],
  });

  const story = storyQuery.data?.[0];

  const figmaLink =
    story && isMDXStory(story) ? story.exports.frontmatter?.resources?.figma : null;

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
                <ComponentTag el={props.el} />
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
      {isOpen &&
        props.subMenuPortalRef &&
        createPortal(
          <ProfilingContextMenu
            style={popper.styles.popper}
            css={css`
              max-height: 250px;
              z-index: 1000000 !important;
            `}
          >
            <ProfilingContextMenuGroup>
              <ProfilingContextMenuHeading>{t('Actions')}</ProfilingContextMenuHeading>
              <ProfilingContextMenuItemButton
                {...props.contextMenu.getMenuItemProps({
                  onClick: () => {
                    props.handleModifyWithAI(
                      props.el,
                      props.componentName,
                      props.sourcePath
                    );
                    props.onAction();
                  },
                })}
              >
                {t('Modify with AI')}
              </ProfilingContextMenuItemButton>
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
                    props.copyToClipboard(props.componentName);
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
                    props.copyToClipboard(props.sourcePath);
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
        )}
    </Fragment>
  );
}

function ComponentTag({el}: {el: TraceElement}) {
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

function isTraceElement(el: unknown): el is TraceElement {
  return el instanceof HTMLElement || el instanceof SVGElement;
}

function getComponentName(el: unknown): string {
  if (!isTraceElement(el)) return 'unknown';
  return el.dataset.sentryComponent || el.dataset.sentryElement || 'unknown';
}

function getSourcePath(el: unknown): string {
  if (!isTraceElement(el)) return 'unknown path';
  return el.dataset.sentrySourcePath?.split(/static\//)[1] || 'unknown path';
}

const getFileName = (path: string) => {
  return (path.split('/').pop()?.toLowerCase() || '')
    .replace(/\.stories\.tsx$/, '')
    .replace(/\.tsx$/, '')
    .replace(/\.mdx$/, '');
};

function getComponentStorybookFile(
  el: unknown,
  stories: Record<string, string>
): string | null {
  const sourcePath = getSourcePath(el);
  if (!sourcePath) return null;

  const mdxSourcePath = sourcePath.replace(/\.tsx$/, '.mdx');

  if (stories[mdxSourcePath] && getFileName(mdxSourcePath) === getFileName(sourcePath)) {
    return mdxSourcePath;
  }

  const tsxSourcePath = sourcePath.replace(/\.tsx$/, '.stories.tsx');
  if (stories[tsxSourcePath] && getFileName(tsxSourcePath) === getFileName(sourcePath)) {
    return tsxSourcePath;
  }

  return stories[sourcePath] || null;
}

function getSourcePathFromMouseEvent(event: MouseEvent): TraceElement[] | null {
  if (!event.target || !isTraceElement(event.target)) return null;

  const target = event.target;

  let head = target.dataset.sentrySourcePath
    ? target
    : target.closest('[data-sentry-source-path]');

  if (!head) return null;

  const trace: TraceElement[] = [head as TraceElement];

  head = head.parentElement;

  while (head) {
    const next = head.parentElement?.closest(
      '[data-sentry-source-path]'
    ) as TraceElement | null;
    if (!next || next === head) break;
    trace.push(next);
    head = next;
  }

  return trace;
}

function isCoreComponent(el: unknown): boolean {
  if (!isTraceElement(el)) return false;
  return el.dataset.sentrySourcePath?.includes('app/components/core') ?? false;
}

function isViewComponent(el: unknown): boolean {
  if (!isTraceElement(el)) return false;
  return el.dataset.sentrySourcePath?.includes('app/views') ?? false;
}
