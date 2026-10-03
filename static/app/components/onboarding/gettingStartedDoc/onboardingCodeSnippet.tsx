import {Fragment} from 'react';

import {CodeBlock} from '@sentry/scraps/code';

import {AuthTokenGenerator} from 'sentry/components/onboarding/gettingStartedDoc/authTokenGenerator';
import {useRegisteredTabSelection} from 'sentry/components/onboarding/gettingStartedDoc/selectedCodeTabContext';
import {PACKAGE_LOADING_PLACEHOLDER} from 'sentry/utils/gettingStartedDocs/getPackageVersion';
import {useFormattedCode} from 'sentry/utils/useFormattedCode';
import type {SyntaxHighlightLine} from 'sentry/utils/usePrismTokens';

const AUTH_TOKEN = '___ORG_AUTH_TOKEN___';

interface OnboardingCodeSnippetProps extends Omit<
  React.ComponentProps<typeof CodeBlock>,
  'renderToken'
> {}

const JAVASCRIPT_FORMAT_OPTIONS = {
  indent_size: 2,
  e4x: true,
  brace_style: 'preserve-inline',
} as const;

/**
 * Renders a highlighted token, swapping the `___ORG_AUTH_TOKEN___` placeholder
 * for an inline AuthTokenGenerator. The placeholder always lands inside a single
 * token, so splitting that token's text is enough — no DOM post-processing.
 */
function renderTokenWithAuthGenerator(token: SyntaxHighlightLine[number], key: number) {
  if (!token.children.includes(AUTH_TOKEN)) {
    return (
      <span key={key} className={token.className}>
        {token.children}
      </span>
    );
  }

  const parts = token.children.split(AUTH_TOKEN);
  return (
    <span key={key} className={token.className}>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {part}
          {i < parts.length - 1 && <AuthTokenGenerator />}
        </Fragment>
      ))}
    </span>
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
  const partialLoading = children.includes(PACKAGE_LOADING_PLACEHOLDER);

  const {formattedCode} = useFormattedCode({
    code: children,
    language: language === 'javascript' ? 'javascript' : null,
    options: JAVASCRIPT_FORMAT_OPTIONS,
  });

  return (
    <CodeBlock
      dark
      language={language}
      hideCopyButton={partialLoading}
      disableUserSelection={partialLoading}
      {...props}
      renderToken={renderTokenWithAuthGenerator}
    >
      {formattedCode}
    </CodeBlock>
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
