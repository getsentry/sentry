import type {ReactNode} from 'react';
import {ThemeProvider} from '@emotion/react';
import {
  render as rtlRender,
  renderHook as rtlRenderHook,
  type RenderHookOptions,
  type RenderOptions,
  type RenderResult,
} from '@testing-library/react';

import {lightTheme} from '@sentry/scraps/theme';

export {act, screen} from '@testing-library/react';

function ThemeWrapper({children}: {children: ReactNode}) {
  return <ThemeProvider theme={lightTheme}>{children}</ThemeProvider>;
}

export function render(ui: ReactNode, options?: RenderOptions): RenderResult {
  return rtlRender(ui, {wrapper: ThemeWrapper, ...options});
}

export function renderHook<Result, Props>(
  callback: (props: Props) => Result,
  options?: RenderHookOptions<Props>
) {
  return rtlRenderHook(callback, {wrapper: ThemeWrapper, ...options});
}
