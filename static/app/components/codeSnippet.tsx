import {ComponentType, useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import styled from '@emotion/styled';
import Prism from 'prismjs';

import {Button} from 'sentry/components/button';
import {IconCopy} from 'sentry/icons';
import {t} from 'sentry/locale';
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
    (acc, token) => ({
      ...acc,
      [token]: Array.from<HTMLSpanElement>(
        element.querySelectorAll(`span[data-token=${token}]`)
      ),
    }),
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
  tokenReplacers?: TokenReplacer;
}

interface TokenReplacer {
  [token: string]: ComponentType;
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
      setTokenNodes(nodes);
    };

    if (language in Prism.languages) {
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

  const tooltipTitle =
    tooltipState === 'copy'
      ? t('Copy')
      : tooltipState === 'copied'
      ? t('Copied')
      : t('Unable to copy');

  return (
    <Wrapper className={`${dark ? 'prism-dark ' : ''}${className ?? ''}`}>
      <Header hasFileName={!!filename}>
        {filename && <FileName>{filename}</FileName>}
        {!hideCopyButton && (
          <CopyButton
            type="button"
            size="xs"
            translucentBorder
            borderless={!!filename}
            onClick={handleCopy}
            title={tooltipTitle}
            tooltipProps={{delay: 0, isHoverable: false, position: 'left'}}
            onMouseLeave={() => setTooltipState('copy')}
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
  background: ${p => p.theme.backgroundSecondary};
  border-radius: ${p => p.theme.borderRadius};

  pre {
    margin: 0;
  }
`;

const Header = styled('div')<{hasFileName: boolean}>`
  display: flex;
  justify-content: space-between;
  align-items: center;

  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.codeFontSize};
  color: ${p => p.theme.headingColor};
  font-weight: 600;
  z-index: 2;

  ${p =>
    p.hasFileName
      ? `
      padding: ${space(0.5)} 0;
      margin: 0 ${space(0.5)} 0 ${space(2)};
      border-bottom: solid 1px ${p.theme.innerBorder};
    `
      : `
      justify-content: flex-end;
      position: absolute;
      top: 0;
      right: 0;
      width: max-content;
      height: max-content;
      max-height: 100%;
      padding: ${space(1)};
    `}
`;

const FileName = styled('p')`
  ${p => p.theme.overflowEllipsis}
  margin: 0;
`;

const CopyButton = styled(Button)`
  color: ${p => p.theme.subText};

  transition: opacity 0.1s ease-out;
  opacity: 0;

  p + &, /* if preceded by FileName */
  div:hover > div > &, /* if Wrapper is hovered */
  &.focus-visible {
    opacity: 1;
  }
`;

const Code = styled('code')<{disableUserSelection?: boolean}>`
  user-select: ${p => (p.disableUserSelection ? 'none' : 'auto')};
`;
