import {useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import Prism from 'prismjs';

import {Button} from 'sentry/components/button';
import {IconCopy} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {loadPrismLanguage} from 'sentry/utils/loadPrismLanguage';

interface CodeSnippetProps {
  children: string;
  language: string;
  className?: string;
  dark?: boolean;
  filename?: string;
  hideCopyButton?: boolean;
  onCopy?: (copiedCode: string) => void;
}

export function CodeSnippet({
  children,
  language,
  dark,
  filename,
  hideCopyButton,
  onCopy,
  className,
}: CodeSnippetProps) {
  const ref = useRef<HTMLModElement | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    if (language in Prism.languages) {
      Prism.highlightElement(element);
      return;
    }

    loadPrismLanguage(language, {onLoad: () => Prism.highlightElement(element)});
  }, [children, language]);

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
