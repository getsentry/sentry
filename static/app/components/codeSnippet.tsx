// Prism components need to be imported after Prism
// eslint-disable-next-line simple-import-sort/imports
import Prism from 'prismjs';
import 'prismjs/components/prism-bash.min';

import {useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {IconCopy} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';

interface CodeSnippetProps extends React.HTMLAttributes<HTMLDivElement> {
  children: string;
  language: keyof typeof Prism.languages;
  dark?: boolean;
  filename?: string;
  hideCopyButton?: boolean;
}

export function CodeSnippet({
  children,
  language,
  dark,
  filename,
  hideCopyButton,
  className,
  ...wrapperProps
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
    <Wrapper className={`${className} ${dark ? 'prism-dark' : ''}`} {...wrapperProps}>
      <Header hasFileName={!!filename}>
        {filename && <Title>{filename}</Title>}
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

      transition: opacity 0.1s ease-out;
      opacity: 0;
      div:hover > & {
        opacity: 1;
      }
    `}
`;

const Title = styled('p')`
  ${p => p.theme.overflowEllipsis}
  margin: 0;
`;

const CopyButton = styled(Button)`
  color: ${p => p.theme.subText};
`;
