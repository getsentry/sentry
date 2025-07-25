import {Fragment, useEffect, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import createCache from '@emotion/cache';
import type {Theme} from '@emotion/react';
import {CacheProvider, ThemeProvider} from '@emotion/react';
import color from 'color';

import {loadPreferencesState} from 'sentry/actionCreators/preferences';
import {Flex} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import GlobalStyles from 'sentry/styles/global';
import {useThemeSwitcher} from 'sentry/utils/theme/useThemeSwitcher';
import {useHotkeys} from 'sentry/utils/useHotkeys';

type Props = {
  children: React.ReactNode;
};

// XXX(epurkhiser): We create our own emotion cache object to disable the
// stylis prefixer plugin. This plugin does NOT use browserlist to determine
// what needs prefixed, just applies ALL prefixes.
//
// In 2022 prefixes are almost ubiquitously unnecessary
const cache = createCache({key: 'app', stylisPlugins: []});
// Compat disables :nth-child warning
cache.compat = true;

/**
 * Wraps children with emotions ThemeProvider reactively set a theme.
 *
 * Also injects the sentry GlobalStyles .
 */
export function ThemeAndStyleProvider({children}: Props) {
  // @TODO(jonasbadalic): the preferences state here seems related to just the sidebar collapse state
  useEffect(() => void loadPreferencesState(), []);

  const config = useLegacyStore(ConfigStore);
  const theme = useThemeSwitcher();

  return (
    <ThemeProvider theme={theme as Theme}>
      <GlobalStyles isDark={config.theme === 'dark'} theme={theme as Theme} />
      <CacheProvider value={cache}>{children}</CacheProvider>
      {createPortal(
        <Fragment>
          <meta name="color-scheme" content={config.theme} />
          <meta name="theme-color" content={theme.sidebar.background} />
        </Fragment>,
        document.head
      )}
      <SentryInspector theme={theme as Theme} />
    </ThemeProvider>
  );
}

function SentryInspector({theme}: {theme: Theme}) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<{enabled: boolean; trace: Element[] | null}>({
    enabled: true,
    trace: [],
  });

  // Store the state in a ref to avoid re-rendering inside the listeners
  const stateRef = useRef(state);
  stateRef.current = state;

  const hotkey = useMemo(() => {
    return [
      {
        match: ['command+shift+c', 'ctrl+shift+c'],
        includeInputs: true,
        callback: () => {
          setState(prev => ({
            ...prev,
            enabled: !prev.enabled,
          }));
        },
      },
    ];
  }, []);

  useHotkeys(hotkey);

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      window.requestAnimationFrame(() => {
        let trace = getSourcePathFromMouseEvent(event);
        if (trace?.[0] === stateRef.current.trace?.[0]) {
          return;
        }

        if (!trace) {
          document
            .querySelectorAll('[data-sentry-component-trace]')
            .forEach(el => delete (el as HTMLElement).dataset.sentryComponentTrace);

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

        const removeNodes = new Set<HTMLElement>(
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
      if (state.enabled) {
        setState(prev => ({
          ...prev,
          enabled: true,
          trace: null,
        }));
      }
    };

    if (state.enabled) {
      document.body.addEventListener('mousemove', onMouseMove);
    } else {
      document.body.removeEventListener('mousemove', onMouseMove);
    }

    window.addEventListener('scroll', onScroll, {passive: true});

    return () => {
      window.removeEventListener('scroll', onScroll);
      document.body.removeEventListener('mousemove', onMouseMove);
    };
  }, [state.enabled]);

  return createPortal(
    <Fragment>
      {state.enabled ? (
        <Fragment>
          <div
            ref={tooltipRef}
            className="sentry-component-trace-tooltip"
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              zIndex: 1000,
              backgroundColor: theme.tokens.background.primary,
              border: `1px solid ${theme.tokens.border.primary}`,
            }}
          >
            <Flex direction="column-reverse" gap="md" style={{padding: theme.space.md}}>
              {state.trace?.slice(0, 6).map((el, index) => (
                <Flex key={index} direction="row" gap="md">
                  <Text>{el.dataset.sentryComponent}</Text>
                  <Text>{el.dataset.sentrySourcePath}</Text>
                </Flex>
              ))}
            </Flex>
          </div>
          <style>
            {`

          [data-sentry-source-path] {
            box-shadow: 0 0 0 1px ${color(theme.tokens.border.accent).alpha(0.3).toString()} !important;
          }

          [data-sentry-source-path*="app/components/core"] {
            box-shadow: 0 0 0 1px ${color(theme.tokens.border.accent).alpha(0.3).toString()} !important;

            [data-sentry-source-path*="app/components/core"],
            [data-sentry-source-path] {
              box-shadow: none !important;
            }
          }

          .sentry-component-trace-tooltip * {
            box-shadow: unset !important;
          }

          [data-sentry-component-trace][data-sentry-source-path] {
            box-shadow: 0 0 0 2px ${theme.tokens.border.accent} !important;
          }

          [data-sentry-component-trace][data-sentry-source-path*="app/components/core"] {
            box-shadow: 0 0 0 2px ${theme.tokens.border.accent} !important;

            [data-sentry-source-path*="app/components/core"],
            [data-sentry-source-path] {
              box-shadow: none !important;
            }
          }

        `}
          </style>
        </Fragment>
      ) : null}
    </Fragment>,
    document.body
  );
}

function getSourcePathFromMouseEvent(event: MouseEvent): HTMLElement[] | null {
  if (!event.target || !(event.target instanceof HTMLElement)) return null;

  const target = event.target;

  let head = target.dataset.sentrySourcePath
    ? target
    : target.closest('[data-sentry-source-path]');

  if (!head) return null;

  const trace: HTMLElement[] = [head as HTMLElement];

  head = head.parentElement;

  while (head) {
    const next = head.parentElement?.closest('[data-sentry-source-path]');
    if (!next || next === head) break;
    trace.push(next as HTMLElement);
    head = next;
  }

  return trace;
}
