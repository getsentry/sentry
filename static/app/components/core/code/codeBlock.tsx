import {Fragment, useState} from 'react';
import {css, ThemeProvider, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Container} from '@sentry/scraps/layout';
import {useTranslation} from '@sentry/scraps/translationContext';

import {IconCopy} from 'sentry/icons';
import {darkTheme} from 'sentry/utils/theme/theme';
import type {SyntaxHighlightLine} from 'sentry/utils/usePrismTokens';
import {usePrismTokens} from 'sentry/utils/usePrismTokens';

type SyntaxToken = SyntaxHighlightLine[number];

function defaultRenderToken(token: SyntaxToken, key: number) {
  return (
    <span key={key} className={token.className}>
      {token.children}
    </span>
  );
}

interface CodeBlockProps {
  children: string;
  /**
   * Keeps the copy button visible when it floats over the code snippet.
   */
  alwaysShowCopyButton?: boolean;
  className?: string;
  dark?: boolean;
  ['data-render-inline']?: boolean;
  /**
   * Makes the text of the element and its sub-elements not selectable.
   * Useful when loading parts of a code snippet, and
   * we wish to avoid users copying them manually.
   */
  disableUserSelection?: boolean;
  /**
   * Name of the file to be displayed at the top of the code snippet.
   */
  filename?: string;
  /**
   * Hides the copy button in the top right.
   */
  hideCopyButton?: boolean;
  /**
   * Adds an icon to the top right, next to the copy button.
   */
  icon?: React.ReactNode;
  /**
   * Controls whether the snippet wrapper has rounded corners.
   */
  isRounded?: boolean;
  language?: string;
  /**
   * Line numbers of the code that will be visually highlighted.
   */
  linesToHighlight?: number[];
  /**
   * Fires with the user presses the copy button.
   */
  onCopy?: (copiedCode: string) => void;
  /**
   * Fires when the user selects and copies code snippet manually
   */
  onSelectAndCopy?: () => void;
  /**
   * Fires when the user switches tabs.
   */
  onTabClick?: (tab: string) => void;
  ref?: React.Ref<HTMLDivElement>;
  /**
   * Overrides how a single highlighted token is rendered. Used to inject
   * interactive content (e.g. the onboarding auth-token generator) in place of
   * a placeholder without post-processing the DOM.
   */
  renderToken?: (token: SyntaxToken, key: number) => React.ReactNode;
  selectedTab?: string;
  tabs?: Array<{
    label: string;
    value: string;
  }>;
  /**
   * Controls whether long lines scroll horizontally or wrap within the snippet.
   *
   * @default 'scroll'
   */
  wrapMode?: 'scroll' | 'wrap';
}

export function CodeBlock({
  alwaysShowCopyButton,
  children,
  className,
  dark,
  'data-render-inline': dataRenderInline,
  disableUserSelection,
  filename,
  hideCopyButton,
  language,
  linesToHighlight,
  icon,
  isRounded = true,
  onCopy,
  onSelectAndCopy,
  onTabClick,
  ref: forwardedRef,
  renderToken = defaultRenderToken,
  selectedTab,
  tabs,
  wrapMode = 'scroll',
}: CodeBlockProps) {
  const {t} = useTranslation();
  const theme = useTheme();

  // Render syntax highlighting as React nodes (via Prism.tokenize) rather than
  // letting Prism write to innerHTML, which Trusted Types blocks.
  const lines = usePrismTokens({code: children, language: language ?? ''});

  const [tooltipState, setTooltipState] = useState<'copy' | 'copied' | 'error'>('copy');

  const handleCopy = () => {
    navigator.clipboard
      .writeText(children)
      .then(() => {
        setTooltipState('copied');
      })
      .catch(() => {
        setTooltipState('error');
      });
    onCopy?.(children);
  };

  const hasTabs = tabs && tabs.length > 0;
  const hasFloatingHeader = !(filename || hasTabs);

  const tooltipTitle =
    tooltipState === 'copy'
      ? t('Copy')
      : tooltipState === 'copied'
        ? t('Copied')
        : t('Unable to copy');

  const snippet = (
    <Wrapper
      ref={forwardedRef}
      reserveCopyButtonSpace={alwaysShowCopyButton && hasFloatingHeader}
      isRounded={isRounded}
      wrapMode={wrapMode}
      className={`${dark ? 'prism-dark ' : ''}${className ?? ''}`}
      data-render-inline={dataRenderInline}
    >
      <Header isFloating={hasFloatingHeader}>
        {hasTabs && (
          <Fragment>
            <TabsWrapper>
              {tabs.map(({label, value}) => (
                <Tab
                  type="button"
                  isSelected={selectedTab === value}
                  onClick={() => onTabClick?.(value)}
                  key={value}
                >
                  {label}
                </Tab>
              ))}
            </TabsWrapper>
            <Container flexGrow={1} />
          </Fragment>
        )}
        {icon}
        {filename && <FileName>{filename}</FileName>}
        {!hasTabs && <Container flexGrow={1} />}
        {!hideCopyButton && (
          <CopyButton
            type="button"
            size="xs"
            variant="transparent"
            onClick={handleCopy}
            tooltipProps={{position: 'left', title: tooltipTitle}}
            onMouseLeave={() => setTooltipState('copy')}
            isAlwaysVisible={
              alwaysShowCopyButton || !hasFloatingHeader || (!!icon && hasFloatingHeader)
            }
            aria-label={t('Copy snippet')}
            icon={<IconCopy />}
          />
        )}
      </Header>
      <ScrollWrapper
        reserveCopyButtonSpace={alwaysShowCopyButton && hasFloatingHeader}
        wrapMode={wrapMode}
      >
        <pre className={`language-${String(language)}`}>
          <Code
            className={`language-${String(language)}`}
            onCopy={onSelectAndCopy}
            disableUserSelection={disableUserSelection}
            wrapMode={wrapMode}
          >
            {lines.map((line, i) => {
              const newline = i < lines.length - 1 ? '\n' : '';
              const tokens = line.map(renderToken);
              return linesToHighlight?.includes(i + 1) ? (
                <Fragment key={i}>
                  <HighlightedLine>{tokens}</HighlightedLine>
                  {newline}
                </Fragment>
              ) : (
                <Fragment key={i}>
                  {tokens}
                  {newline}
                </Fragment>
              );
            })}
          </Code>
        </pre>
      </ScrollWrapper>
    </Wrapper>
  );

  // Override theme provider when in dark mode to provider dark theme to
  // components
  return <ThemeProvider theme={dark ? darkTheme : theme}>{snippet}</ThemeProvider>;
}

const Wrapper = styled('div')<{
  isRounded: boolean;
  wrapMode: 'scroll' | 'wrap';
  reserveCopyButtonSpace?: boolean;
}>`
  position: relative;
  height: 100%;
  min-width: 0;
  background: var(--prism-block-background);
  border-radius: ${p => (p.isRounded ? p.theme.radius.md : '0px')};

  && pre[class*='language-'] {
    margin: 0;
    height: 100%;
    width: ${p => (p.wrapMode === 'wrap' ? '100%' : 'max-content')};
    min-width: 100%;
    white-space: ${p => (p.wrapMode === 'wrap' ? 'pre-wrap' : 'pre')};
    overflow-wrap: ${p => (p.wrapMode === 'wrap' ? 'anywhere' : 'normal')};

    ${p =>
      p.wrapMode === 'wrap' &&
      p.reserveCopyButtonSpace &&
      css`
        &::before {
          content: '';
          float: right;
          width: ${p.theme.space.lg};
          height: ${p.theme.space.xl};
        }
      `}
  }

  &[data-render-inline='true'] pre {
    padding: 0;
  }
`;

const Header = styled('div')<{isFloating: boolean}>`
  display: flex;
  align-items: center;

  font-family: ${p => p.theme.font.family.mono};
  font-size: ${p => p.theme.font.size.sm};
  color: var(--prism-base);
  font-weight: ${p => p.theme.font.weight.mono.medium};
  z-index: 2;

  ${p =>
    p.isFloating
      ? css`
          gap: ${p.theme.space['2xs']};
          justify-content: flex-end;
          position: absolute;
          top: 0;
          right: 0;
          width: max-content;
          height: max-content;
          max-height: 100%;
          padding: ${p.theme.space.xs};
        `
      : css`
          gap: ${p.theme.space.sm};
          padding: ${p.theme.space.xs} ${p.theme.space.xs} 0 ${p.theme.space.md};
          border-bottom: solid 1px ${p.theme.tokens.border.primary};
        `}
`;

const FileName = styled('span')`
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: auto;
`;

const TabsWrapper = styled('div')`
  padding: 0;
  display: flex;
  overflow-x: auto;
`;

const Tab = styled('button')<{isSelected: boolean}>`
  box-sizing: border-box;
  display: block;
  margin: 0;
  border: none;
  background: none;
  padding: ${p => p.theme.space.md} ${p => p.theme.space.md};
  color: var(--prism-comment);
  ${p =>
    p.isSelected
      ? css`
          border-bottom: 3px solid ${p.theme.tokens.graphics.accent.vibrant};
          padding-bottom: 5px;
          color: var(--prism-base);
        `
      : ''}
`;

const CopyButton = styled(Button)<{isAlwaysVisible: boolean}>`
  color: var(--prism-comment);
  transition: opacity 0.1s ease-out;
  opacity: 0;

  div:hover > div > &, /* if Wrapper is hovered */
  &:focus-visible {
    opacity: 1;
  }
  &:hover {
    color: var(--prism-base);
  }
  ${p => (p.isAlwaysVisible ? 'opacity: 1;' : '')}
`;

const ScrollWrapper = styled('div')<{
  wrapMode: 'scroll' | 'wrap';
  reserveCopyButtonSpace?: boolean;
}>`
  overflow-x: ${p => (p.wrapMode === 'wrap' ? 'hidden' : 'auto')};
  height: 100%;
  margin-right: ${p =>
    p.wrapMode === 'scroll' && p.reserveCopyButtonSpace ? p.theme.space['3xl'] : '0'};
`;

const Code = styled('code')<{
  wrapMode: 'scroll' | 'wrap';
  disableUserSelection?: boolean;
}>`
  user-select: ${p => (p.disableUserSelection ? 'none' : 'auto')};

  ${p =>
    p.wrapMode === 'wrap' &&
    css`
      && {
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
    `}
`;

// Highlighted lines stay in the inline flow (the surrounding `\n` text nodes
// still produce the line breaks and keep textContent faithful), but stretch to
// full width so the background reads as a highlighted row.
const HighlightedLine = styled('span')`
  display: inline-block;
  width: 100%;
  background: var(--prism-highlight-background, rgba(255, 255, 255, 0.08));
  box-shadow: inset 3px 0 0 var(--prism-highlight-accent, currentColor);
`;
