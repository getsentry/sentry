import {Fragment, useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import styled from '@emotion/styled';
import Prism from 'prismjs';

import {Button} from 'sentry/components/button';
import {NODE_ENV} from 'sentry/constants';
import {IconCopy} from 'sentry/icons';
import {t} from 'sentry/locale';
import {prismStyles} from 'sentry/styles/prism';
import {space} from 'sentry/styles/space';
import {loadPrismLanguage} from 'sentry/utils/loadPrismLanguage';

/**
 * Replaces tokens in a DOM element with a span element.
 * @param element DOM element in which the tokens will be replaced
 * @param tokens array of tokens to be replaced
 * @returns object with keys as tokens and values as array of HTMLSpanElement
 */
export function replaceTokensWithSpan(element: HTMLElement, tokens: string[]) {
  const replaceRegex = new RegExp(`(${tokens.join('|')})`, 'g');
  element.innerHTML = element.innerHTML.replace(
    replaceRegex,
    '<span data-token="$1"></span>'
  );

  const nodes = tokens.reduce(
    (acc, token) => {
      const tokenNodes = Array.from<HTMLSpanElement>(
        element.querySelectorAll(`[data-token="${token}"]`)
      );
      return tokenNodes.length > 0
        ? {
            ...acc,
            [token]: tokenNodes,
          }
        : acc;
    },
    {} as Record<string, HTMLSpanElement[]>
  );
  return nodes;
}

interface CodeSnippetProps {
  children: string;
  language: string;
  className?: string;
  dark?: boolean;
  /**
   * Makes the text of the element and its sub-elements not selectable.
   * Userful when loading parts of a code snippet, and
   * we wish to avoid users copying them manually.
   */
  disableUserSelection?: boolean;
  filename?: string;
  hideCopyButton?: boolean;
  onCopy?: (copiedCode: string) => void;
  /**
   * Fired when the user selects and copies code snippet manually
   */
  onSelectAndCopy?: () => void;
  onTabClick?: (tab: string) => void;
  selectedTab?: string;
  tabs?: {
    label: string;
    value: string;
  }[];
  tokenReplacers?: TokenReplacer;
}

interface TokenReplacer {
  [token: string]: React.ComponentType;
}

export function CodeSnippet({
  children,
  language,
  dark,
  filename,
  hideCopyButton,
  onCopy,
  className,
  onSelectAndCopy,
  disableUserSelection,
  tokenReplacers,
  selectedTab,
  onTabClick,
  tabs,
}: CodeSnippetProps) {
  const ref = useRef<HTMLModElement | null>(null);
  const [tokenNodes, setTokenNodes] = useState<Record<string, HTMLSpanElement[]>>({});

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return () => {};
    }

    const applyTokenReplacers = () => {
      if (!tokenReplacers) {
        return;
      }
      const nodes = replaceTokensWithSpan(element, Object.keys(tokenReplacers));
      if (Object.keys(nodes).length > 0) {
        setTokenNodes(nodes);
      }
    };

    // Don't load languages in test environment as it takes long enough to trigger
    // console error about updating state without act() when setState is called afterwords
    if (language in Prism.languages || NODE_ENV === 'test') {
      Prism.highlightElement(element, false, applyTokenReplacers);
      return () => {};
    }

    loadPrismLanguage(language, {
      onLoad: () => Prism.highlightElement(element, false, applyTokenReplacers),
    });

    return () => {
      setTokenNodes({});
    };
  }, [children, language, tokenReplacers]);

  const [tooltipState, setTooltipState] = useState<'copy' | 'copied' | 'error'>('copy');

  const handleCopy = () => {
    navigator.clipboard
      .writeText(ref.current?.textContent ?? '')
      .then(() => {
        setTooltipState('copied');
      })
      .catch(() => {
        setTooltipState('error');
      });
    onCopy?.(children);
  };

  const hasTabs = tabs && tabs.length > 0;
  const hasSolidHeader = !!(filename || hasTabs);

  const tooltipTitle =
    tooltipState === 'copy'
      ? t('Copy')
      : tooltipState === 'copied'
      ? t('Copied')
      : t('Unable to copy');

  return (
    <Wrapper className={`${dark ? 'prism-dark ' : ''}${className ?? ''}`}>
      <Header isSolid={hasSolidHeader}>
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
            <FlexSpacer />
          </Fragment>
        )}
        {filename && <FileName>{filename}</FileName>}
        {!hasTabs && <FlexSpacer />}
        {!hideCopyButton && (
          <CopyButton
            type="button"
            size="xs"
            translucentBorder
            borderless
            onClick={handleCopy}
            title={tooltipTitle}
            tooltipProps={{delay: 0, isHoverable: false, position: 'left'}}
            onMouseLeave={() => setTooltipState('copy')}
            isAlwaysVisible={hasSolidHeader}
          >
            <IconCopy size="xs" />
          </CopyButton>
        )}
      </Header>

      <pre className={`language-${String(language)}`}>
        <Code
          ref={ref}
          className={`language-${String(language)}`}
          onCopy={onSelectAndCopy}
          disableUserSelection={disableUserSelection}
        >
          {children}
        </Code>
      </pre>
      {tokenReplacers &&
        Object.entries(tokenNodes).map(([token, nodes]) => {
          const TokenReplacer = tokenReplacers[token];
          return nodes.map((node, index) =>
            createPortal(<TokenReplacer />, node, `${token}_${index}`)
          );
        })}
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  position: relative;
  background: var(--prism-block-background);
  border-radius: ${p => p.theme.borderRadius};

  ${p => prismStyles(p.theme)}
  pre {
    margin: 0;
  }
`;

const Header = styled('div')<{isSolid: boolean}>`
  display: flex;
  align-items: center;

  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.codeFontSize};
  color: var(--prism-base);
  font-weight: 600;
  z-index: 2;

  ${p =>
    p.isSolid
      ? `
      margin: 0 ${space(0.5)};
      border-bottom: solid 1px var(--prism-highlight-accent);
    `
      : `
      justify-content: flex-end;
      position: absolute;
      top: 0;
      right: 0;
      width: max-content;
      height: max-content;
      max-height: 100%;
      padding: ${space(0.5)};
    `}
`;

const FileName = styled('p')`
  ${p => p.theme.overflowEllipsis}
  padding: ${space(0.5)} ${space(0.5)};
  margin: 0;
  width: auto;
`;

const TabsWrapper = styled('div')`
  padding: 0;
  display: flex;
`;

const Tab = styled('button')<{isSelected: boolean}>`
  box-sizing: border-box;
  display: block;
  margin: 0;
  border: none;
  background: none;
  padding: ${space(1)} ${space(1)};
  color: var(--prism-comment);
  ${p =>
    p.isSelected
      ? `border-bottom: 3px solid ${p.theme.purple300};
      padding-bottom: 5px;
      color: var(--prism-base);`
      : ''}
`;

const FlexSpacer = styled('div')`
  flex-grow: 1;
`;

const CopyButton = styled(Button)<{isAlwaysVisible: boolean}>`
  color: var(--prism-comment);
  transition: opacity 0.1s ease-out;
  opacity: 0;

  div:hover > div > &, /* if Wrapper is hovered */
  &.focus-visible {
    opacity: 1;
  }
  &:hover {
    color: var(--prism-base);
  }
  ${p => (p.isAlwaysVisible ? 'opacity: 1;' : '')}
`;

const Code = styled('code')<{disableUserSelection?: boolean}>`
  user-select: ${p => (p.disableUserSelection ? 'none' : 'auto')};
`;
