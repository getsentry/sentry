import {Fragment, type ReactNode} from 'react';

import {ConfigStore} from 'sentry/stores/configStore';

type WrapCode<T> = (code: string) => T;

/**
 * Builds the agent handoff prompt around its handoff code. `wrapCode` decides how the
 * code appears, such as in backticks for the copied text or masked for the preview, so
 * both share one template and their wording can't drift apart. A wrapper that returns a
 * string produces a plain string prompt. The prompt is read by the agent, so it is
 * intentionally not translated.
 *
 * When `product` is provided, the prompt names the feature so the agent doesn't have
 * to infer it.
 */
export function getHandoffPrompt(
  code: string,
  wrapCode: WrapCode<string>,
  product?: string
): string;
export function getHandoffPrompt(
  code: string,
  wrapCode: WrapCode<ReactNode>,
  product?: string
): ReactNode;
export function getHandoffPrompt(
  code: string,
  wrapCode: WrapCode<ReactNode>,
  product?: string
): ReactNode {
  const guideUrl = `${ConfigStore.get('urlPrefix').replace(/\/$/, '')}/agent-handoff.md`;
  const purpose = product ? ` to set up ${product}` : '';
  const start = `Read and follow ${guideUrl} verbatim${purpose}. Your handoff code is `;
  const end = '.';
  const wrappedCode = wrapCode(code);

  if (typeof wrappedCode === 'string') {
    return `${start}${wrappedCode}${end}`;
  }

  return (
    <Fragment>
      {start}
      {wrappedCode}
      {end}
    </Fragment>
  );
}
