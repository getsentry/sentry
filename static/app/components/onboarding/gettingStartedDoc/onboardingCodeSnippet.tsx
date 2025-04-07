import {Fragment, useCallback, useState} from 'react';
import {createPortal} from 'react-dom';
import beautify from 'js-beautify';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import {AuthTokenGenerator} from 'sentry/components/onboarding/gettingStartedDoc/authTokenGenerator';

interface OnboardingCodeSnippetProps
  extends Omit<React.ComponentProps<typeof CodeSnippet>, 'onAfterHighlight'> {}

/**
 * Replaces tokens in a DOM element with a span element.
 * @param element DOM element in which the tokens will be replaced
 * @param tokens array of tokens to be replaced
 * @returns object with keys as tokens and values as array of HTMLSpanElement
 */
export function replaceTokensWithSpan(element: HTMLElement) {
  element.innerHTML = element.innerHTML.replace(
    /(___ORG_AUTH_TOKEN___)/g,
    '<span data-token="$1"></span>'
  );

  return Array.from<HTMLSpanElement>(
    element.querySelectorAll(`[data-token="___ORG_AUTH_TOKEN___"]`)
  );
}

/**
 * Code snippet component that replaces `___ORG_AUTH_TOKEN___` inside snippets with AuthTokenGenerator.
 */
export function OnboardingCodeSnippet({
  children,
  language,
  ...props
}: OnboardingCodeSnippetProps) {
  const [authTokenNodes, setAuthTokenNodes] = useState<HTMLSpanElement[]>([]);

  const handleAfterHighlight = useCallback((element: HTMLElement) => {
    setAuthTokenNodes(replaceTokensWithSpan(element));
  }, []);

  return (
    <Fragment>
      <CodeSnippet
        dark
        language={language}
        {...props}
        onAfterHighlight={handleAfterHighlight}
      >
        {/* Trim whitespace from code snippets and beautify javascript code */}
        {language === 'javascript'
          ? beautify.js(children, {
              indent_size: 2,
              e4x: true,
              brace_style: 'preserve-inline',
            })
          : children.trim()}
      </CodeSnippet>
      {authTokenNodes.map(node => createPortal(<AuthTokenGenerator />, node))}
    </Fragment>
  );
}
