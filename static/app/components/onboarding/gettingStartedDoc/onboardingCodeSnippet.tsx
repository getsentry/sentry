import {Fragment, useCallback, useMemo, useState} from 'react';
import {createPortal} from 'react-dom';

import {CodeBlock} from '@sentry/scraps/code';

import {AuthTokenGenerator} from 'sentry/components/onboarding/gettingStartedDoc/authTokenGenerator';
import {useRegisteredTabSelection} from 'sentry/components/onboarding/gettingStartedDoc/selectedCodeTabContext';
import {PACKAGE_LOADING_PLACEHOLDER} from 'sentry/utils/gettingStartedDocs/getPackageVersion';
import {useFormattedCode} from 'sentry/utils/useFormattedCode';

interface OnboardingCodeSnippetProps extends Omit<
  React.ComponentProps<typeof CodeBlock>,
  'onAfterHighlight'
> {}

const JAVASCRIPT_FORMAT_OPTIONS = {
  indent_size: 2,
  e4x: true,
  brace_style: 'preserve-inline',
} as const;

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
    element.querySelectorAll('[data-token="___ORG_AUTH_TOKEN___"]')
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

  const partialLoading = useMemo(
    () => children.includes(PACKAGE_LOADING_PLACEHOLDER),
    [children]
  );

  const {formattedCode} = useFormattedCode({
    code: children,
    language: language === 'javascript' ? 'javascript' : null,
    options: JAVASCRIPT_FORMAT_OPTIONS,
  });

  return (
    <Fragment>
      <CodeBlock
        dark
        language={language}
        hideCopyButton={partialLoading}
        disableUserSelection={partialLoading}
        {...props}
        onAfterHighlight={handleAfterHighlight}
      >
        {formattedCode}
      </CodeBlock>
      {authTokenNodes.map(node => createPortal(<AuthTokenGenerator />, node))}
    </Fragment>
  );
}

export interface CodeSnippetTab {
  code: string;
  label: string;
  language: string;
  value: string;
  filename?: string;
}

interface TabbedCodeSnippetProps {
  /**
   * An array of tabs to be displayed
   */
  tabs: CodeSnippetTab[];
}

export function TabbedCodeSnippet({tabs}: TabbedCodeSnippetProps) {
  const [selectedTabValue, setSelectedTabValue] = useRegisteredTabSelection(tabs);
  const resolvedTab = tabs.find(tab => tab.value === selectedTabValue) ?? tabs[0]!;
  const {code, language, filename} = resolvedTab;

  return (
    <OnboardingCodeSnippet
      language={language}
      tabs={tabs}
      selectedTab={selectedTabValue}
      onTabClick={setSelectedTabValue}
      filename={filename}
    >
      {code}
    </OnboardingCodeSnippet>
  );
}
