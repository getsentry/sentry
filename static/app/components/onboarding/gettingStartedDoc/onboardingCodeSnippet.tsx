import {Fragment, useCallback, useMemo, useState} from 'react';
import {createPortal} from 'react-dom';
import beautify from 'js-beautify';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import {AuthTokenGenerator} from 'sentry/components/onboarding/gettingStartedDoc/authTokenGenerator';
import {PACKAGE_LOADING_PLACEHOLDER} from 'sentry/utils/gettingStartedDocs/getPackageVersion';

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

  const partialLoading = useMemo(
    () => children.includes(PACKAGE_LOADING_PLACEHOLDER),
    [children]
  );

  return (
    <Fragment>
      <CodeSnippet
        dark
        language={language}
        hideCopyButton={partialLoading}
        disableUserSelection={partialLoading}
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
  /**
   * A callback to be invoked when the configuration is copied to the clipboard
   */
  onCopy?: () => void;
  /**
   * A callback to be invoked when the configuration is selected and copied to the clipboard
   */
  onSelectAndCopy?: () => void;
  /**
   * Whether or not the configuration or parts of it are currently being loaded
   */
  partialLoading?: boolean;
}

export function TabbedCodeSnippet({
  tabs,
  onCopy,
  onSelectAndCopy,
  partialLoading,
}: TabbedCodeSnippetProps) {
  const [selectedTabValue, setSelectedTabValue] = useState(tabs[0]!.value);
  const selectedTab = tabs.find(tab => tab.value === selectedTabValue) ?? tabs[0]!;
  const {code, language, filename} = selectedTab;

  return (
    <OnboardingCodeSnippet
      language={language}
      onCopy={onCopy}
      onSelectAndCopy={onSelectAndCopy}
      hideCopyButton={partialLoading}
      disableUserSelection={partialLoading}
      tabs={tabs}
      selectedTab={selectedTabValue}
      onTabClick={value => setSelectedTabValue(value)}
      filename={filename}
    >
      {code}
    </OnboardingCodeSnippet>
  );
}
