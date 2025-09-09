import {Fragment, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import type {Theme} from '@emotion/react';
import color from 'color';

import {Flex} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import {Overlay} from 'sentry/components/overlay';
import {
  ProfilingContextMenu,
  ProfilingContextMenuGroup,
  ProfilingContextMenuHeading,
  ProfilingContextMenuItemButton,
  ProfilingContextMenuLayer,
} from 'sentry/components/profiling/profilingContextMenu';
import {NODE_ENV} from 'sentry/constants';
import {t} from 'sentry/locale';
import {useContextMenu} from 'sentry/utils/profiling/hooks/useContextMenu';
import {useHotkeys} from 'sentry/utils/useHotkeys';
import {useUser} from 'sentry/utils/useUser';

type TraceElement = HTMLElement | SVGElement;

export function SentryInspector({theme}: {theme: Theme}) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const user = useUser();
  const [state, setState] = useState<{
    enabled: null | 'inspector' | 'context-menu';
    trace: TraceElement[] | null;
  }>({
    enabled: null,
    trace: [],
  });

  // Context menu state
  const contextMenu = useContextMenu({container: tooltipRef.current});
  const [contextMenuTrace, setContextMenuTrace] = useState<TraceElement[] | null>(null);

  const tooltipPositionRef = useRef<{
    left: number;
    top: number;
  } | null>(null);

  const contextMenuPositionRef = useRef<{
    left: number;
    top: number;
  } | null>(null);

  // Copy functionality
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

  // Store the state in a ref to avoid re-rendering inside the listeners
  const stateRef = useRef(state);
  stateRef.current = state;

  const hotkey = useMemo(() => {
    if (!user.isStaff) {
      return [];
    }

    return [
      {
        match: ['command+shift+c', 'ctrl+shift+c'],
        includeInputs: true,
        callback: () => {
          setState(prev => ({
            ...prev,
            enabled: prev.enabled === null ? 'inspector' : null,
          }));
        },
      },
    ];
  }, [user.isStaff]);

  useHotkeys(hotkey);

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      window.requestAnimationFrame(() => {
        if (tooltipRef.current) {
          const {innerWidth, innerHeight} = window;
          const OFFSET = 8;
          let top = event.clientY + OFFSET;
          let left = event.clientX + OFFSET;

          if (event.clientX > innerWidth * 0.7) {
            left = event.clientX - (tooltipRef.current.offsetWidth || 0) - OFFSET;
          }
          if (event.clientY > innerHeight * 0.8) {
            top = event.clientY - (tooltipRef.current.offsetHeight || 0) - OFFSET;
          }

          tooltipRef.current.style.top = `${top}px`;
          tooltipRef.current.style.left = `${left}px`;
          tooltipPositionRef.current = {
            left,
            top,
          };
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

    const onScroll = () => {
      contextMenu.setOpen(false);

      tooltipPositionRef.current = null;
      contextMenuPositionRef.current = null;

      if (state.enabled) {
        setState(prev => ({
          ...prev,
          enabled: null,
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
        left: event.clientX,
        top: event.clientY,
      };
    };

    if (state.enabled) {
      document.body.addEventListener('contextmenu', onContextMenu);
      document.body.addEventListener('mousemove', onMouseMove);
    } else {
      document.body.removeEventListener('mousemove', onMouseMove);
      document.body.removeEventListener('contextmenu', onContextMenu);
    }

    window.addEventListener('scroll', onScroll, {passive: true});

    return () => {
      window.removeEventListener('scroll', onScroll);
      document.body.removeEventListener('contextmenu', onContextMenu);
      document.body.removeEventListener('mousemove', onMouseMove);
    };
  }, [state.enabled, contextMenu]);

  const dedupedTrace = useMemo(() => {
    const seen = new Set<TraceElement>();
    const trace = [];

    for (const el of state.trace ?? []) {
      if (!isTraceElement(el)) {
        continue;
      }
      if (seen.has(el)) {
        continue;
      }
      seen.add(el);
      trace.push(el);

      if (trace.length === 3) {
        break;
      }
    }

    return trace;
  }, [state.trace]);

  if (NODE_ENV === 'production') {
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
          <Flex direction="column" gap="xs" style={{padding: theme.space.md}}>
            {dedupedTrace.length === 0 ? (
              <Text size="md" ellipsis monospace>
                no component detected
              </Text>
            ) : (
              dedupedTrace.map((el, index) => (
                <Fragment key={index}>
                  <Text size="md" bold monospace>
                    {getComponentName(el)}
                  </Text>
                  <Text size="sm" variant="muted" ellipsis monospace>
                    ...
                    {getSourcePath(el)}
                  </Text>
                </Fragment>
              ))
            )}
          </Flex>
        </Overlay>
      ) : null}
      {state.enabled === 'context-menu' ? (
        <Fragment>
          <ProfilingContextMenuLayer
            onClick={() => {
              contextMenu.setOpen(false);
              setState(prev => ({
                ...prev,
                // When the user closes the context menu, we go back to the inspector view
                enabled: prev.enabled === 'context-menu' ? 'inspector' : null,
              }));
            }}
          />
          <ProfilingContextMenu
            data-inspector-skip
            {...contextMenu.getMenuProps()}
            style={{
              position: 'fixed',
              maxWidth: '320px',
              width: 'max-content',
              left: contextMenuPositionRef.current?.left ?? 0,
              top: contextMenuPositionRef.current?.top ?? 0,
            }}
          >
            <ProfilingContextMenuGroup>
              <ProfilingContextMenuHeading>
                {t('Component Trace')}
              </ProfilingContextMenuHeading>
              {!contextMenuTrace || contextMenuTrace.length === 0
                ? null
                : contextMenuTrace.map((el, index) => {
                    const componentName = getComponentName(el);
                    const sourcePath = getSourcePath(el);

                    return (
                      <ProfilingContextMenuItemButton
                        key={index}
                        {...contextMenu.getMenuItemProps({
                          onClick: () => {
                            copyToClipboard(`${componentName} - ${sourcePath}`);
                            contextMenu.setOpen(false);
                          },
                        })}
                        style={{
                          width: '100%',
                          overflow: 'hidden',
                        }}
                      >
                        <Flex direction="column" gap="xs" align="start" overflow="hidden">
                          <Text size="sm">{componentName}</Text>
                          <Text size="sm" variant="muted" ellipsis>
                            {sourcePath}
                          </Text>
                        </Flex>
                      </ProfilingContextMenuItemButton>
                    );
                  })}
            </ProfilingContextMenuGroup>
          </ProfilingContextMenu>
        </Fragment>
      ) : null}
      {state.enabled === 'context-menu' || state.enabled === 'inspector' ? (
        <style>
          {`
            /** The internal overlay component forces a lower z-index, so we need to override it **/
            [data-inspector-skip] {
              z-index: 999999 !important;
            }

          // [data-sentry-source-path] {
          //   box-shadow: 0 0 0 1px ${color(theme.tokens.border.success).alpha(0.3).toString()} !important;
          // }

          // [data-sentry-source-path*="app/components/core"] {
          //   box-shadow: 0 0 0 1px ${color(theme.tokens.border.accent).alpha(0.8).toString()} !important;

          //   [data-sentry-source-path*="app/components/core"],
          //   [data-sentry-source-path] {
          //     box-shadow: none !important;
          //   }
          // }

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

            [data-sentry-source-path*="app/components/core"],
            [data-sentry-source-path] {
              box-shadow: none !important;
            }
          }

        `}
        </style>
      ) : null}
    </Fragment>,
    document.body
  );
}

function isTraceElement(el: unknown): el is TraceElement {
  return el instanceof HTMLElement || el instanceof SVGElement;
}

function getComponentName(el: unknown): string {
  if (!isTraceElement(el)) return 'unknown';
  return el.dataset.sentryComponent || 'unknown';
}

function getSourcePath(el: unknown): string {
  if (!isTraceElement(el)) return 'unknown path';
  return el.dataset.sentrySourcePath?.split(/static/)[1] || 'unknown path';
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
