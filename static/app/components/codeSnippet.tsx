import {useEffect, useRef, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import Prism from 'prismjs';

import Button from 'sentry/components/button';
import {IconCopy} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Theme} from 'sentry/utils/theme';

/**
 * Prism styles with support for light/dark mode, to be used as an alternative
 * to 'prism-sentry' and 'prism.css'.
 */
export const prismStyles = ({theme}: {theme: Theme}) => css`
  pre[class*='language-'] {
    overflow-x: scroll;
    padding: ${space(1)} ${space(2)};
    margin: 0;
    background: ${theme.backgroundSecondary};
    border-radius: ${theme.borderRadius};
  }

  pre[class*='language-'],
  code[class*='language-'] {
    color: ${theme.prism.baseColor};
    font-size: ${theme.codeFontSize};
    text-shadow: none;
    font-family: ${theme.text.familyMono};
    direction: ltr;
    text-align: left;
    white-space: pre;
    word-spacing: normal;
    word-break: normal;
    -moz-tab-size: 4;
    -o-tab-size: 4;
    tab-size: 4;
    -webkit-hyphens: none;
    -moz-hyphens: none;
    -ms-hyphens: none;
    hyphens: none;
  }
  pre[class*='language-']::selection,
  code[class*='language-']::selection {
    text-shadow: none;
    background: ${theme.prism.selectedColor};
  }
  @media print {
    pre[class*='language-'],
    code[class*='language-'] {
      text-shadow: none;
    }
  }

  .namespace {
    opacity: 0.7;
  }
  .token.comment,
  .token.prolog,
  .token.doctype,
  .token.cdata {
    color: ${theme.prism.commentColor};
  }
  .token.punctuation {
    color: ${theme.prism.punctuationColor};
  }
  .token.property,
  .token.tag,
  .token.boolean,
  .token.number,
  .token.constant,
  .token.symbol,
  .token.deleted {
    color: ${theme.prism.propertyColor};
  }
  .token.selector,
  .token.attr-name,
  .token.string,
  .token.char,
  .token.builtin,
  .token.inserted {
    color: ${theme.prism.selectorColor};
  }
  .token.operator,
  .token.entity,
  .token.url,
  .language-css .token.string,
  .style .token.string {
    color: ${theme.prism.operatorColor};
    background: none;
  }
  .token.atrule,
  .token.attr-value,
  .token.keyword {
    color: ${theme.prism.keywordColor};
  }
  .token.function {
    color: ${theme.prism.functionColor};
  }
  .token.regex,
  .token.important,
  .token.variable {
    color: ${theme.prism.variableColor};
  }
  .token.important,
  .token.bold {
    font-weight: bold;
  }
  .token.italic {
    font-style: italic;
  }
  .token.entity {
    cursor: help;
  }
  pre[data-line] {
    position: relative;
  }
  pre[class*='language-'] > code[class*='language-'] {
    position: relative;
    z-index: 1;
  }
  .line-highlight {
    position: absolute;
    left: 0;
    right: 0;
    padding: inherit 0;
    margin-top: 1em;
    background: ${theme.prism.highlightBackground};
    box-shadow: inset 5px 0 0 ${theme.prism.highlightAccent};
    z-index: 0;
    pointer-events: none;
    line-height: inherit;
    white-space: pre;
  }
`;

interface CodeSnippetProps {
  children: string;
  language: keyof typeof Prism.languages;
  filename?: string;
  hideCopyButton?: boolean;
}

export function CodeSnippet({
  children,
  language,
  filename,
  hideCopyButton,
}: CodeSnippetProps) {
  const ref = useRef<HTMLModElement | null>(null);

  useEffect(
    () => void (ref.current && Prism.highlightElement(ref.current, false)),
    [children]
  );

  const [tooltipState, setTooltipState] = useState<'copy' | 'copied' | 'error'>('copy');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(children);
      setTooltipState('copied');
    } catch (err) {
      setTooltipState('error');
    }
  };

  const tooltipTitle =
    tooltipState === 'copy'
      ? t('Copy')
      : tooltipState === 'copied'
      ? t('Copied')
      : t('Unable to copy');

  return (
    <Wrapper>
      {filename && (
        <Header>
          {filename}
          {!hideCopyButton && (
            <CopyButton
              type="button"
              size="xs"
              borderless
              isInHeader
              onClick={handleCopy}
              title={tooltipTitle}
              tooltipProps={{delay: 0, isHoverable: false, position: 'left'}}
              onMouseLeave={() => setTooltipState('copy')}
            >
              <IconCopy size="xs" />
            </CopyButton>
          )}
        </Header>
      )}

      {!hideCopyButton && !filename && (
        <CopyButton
          type="button"
          size="xs"
          onClick={handleCopy}
          title={tooltipTitle}
          tooltipProps={{delay: 0, isHoverable: false, position: 'left'}}
          onMouseLeave={() => setTooltipState('copy')}
        >
          <IconCopy size="xs" />
        </CopyButton>
      )}

      <pre className={`language-${String(language)}`}>
        <code ref={ref} className={`language-${String(language)}`}>
          {children}
        </code>
      </pre>
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  position: relative;
  background: ${p => p.theme.backgroundSecondary};
  border-radius: ${p => p.theme.borderRadius};
  ${prismStyles}
`;

const Header = styled('div')`
  position: relative;
  padding: ${space(1)} ${space(2)} ${space(1)} 0;
  margin-left: ${space(2)};
  border-bottom: solid 1px ${p => p.theme.translucentInnerBorder};

  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.codeFontSize};
  color: ${p => p.theme.headingColor};
  font-weight: 600;
`;

const CopyButton = styled(Button)<{isInHeader?: boolean}>`
  position: absolute;

  ${p =>
    p.isInHeader
      ? `
        top: 50%;
        right: ${space(0.5)};
        transform: translateY(-50%);
        `
      : `
        top: ${space(1)};
        right: ${space(1)};

        opacity: 0;
        transition: opacity 0.1s ease-out;
        div:hover > & {
          opacity: 1;
        }
        `}
`;
