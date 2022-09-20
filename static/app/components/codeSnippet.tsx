import 'prism-sentry/index.css';

import {Fragment, useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import Prism from 'prismjs';

import Tooltip from 'sentry/components/tooltip';
import {IconCopy} from 'sentry/icons';
import {t} from 'sentry/locale';

const PreContainer = styled('pre')<{unsetBorderRadiusTop?: boolean}>`
  overflow-x: scroll;
  ${p =>
    p.unsetBorderRadiusTop
      ? `
  border-top-left-radius: 0px;
  border-top-right-radius: 0px;
  `
      : null}

  word-break: break-all;
  white-space: pre-wrap;

  code {
    white-space: pre;
  }
`;
const UnstyledButton = styled('button')`
  all: unset;
  cursor: pointer;
`;

const CodeContainerActionBar = styled('div')`
  display: flex;
  justify-content: end;
  gap: 10px;
  padding: 10px;

  color: ${p => p.theme.white};
  font-size: ${p => p.theme.fontSizeSmall};
  border-bottom: 1px solid ${p => p.theme.purple200};
  background: #251f3d;
  border-radius: ${p => p.theme.borderRadiusTop};
`;

interface CodeSnippetProps {
  children: string;
  language: string;
  filename?: string;
  hideActionBar?: boolean;
}

export function CodeSnippet({
  children,
  language,
  filename,
  hideActionBar,
}: CodeSnippetProps) {
  const ref = useRef<HTMLModElement | null>(null);

  useEffect(() => Prism.highlightElement(ref.current, false), [children]);
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
    <Fragment>
      {!hideActionBar && (
        <CodeContainerActionBar>
          {filename && <span>{filename}</span>}
          <Tooltip delay={0} isHoverable={false} title={tooltipTitle} position="bottom">
            <UnstyledButton
              type="button"
              onClick={handleCopy}
              onMouseLeave={() => setTooltipState('copy')}
            >
              <IconCopy />
            </UnstyledButton>
          </Tooltip>
        </CodeContainerActionBar>
      )}

      <PreContainer unsetBorderRadiusTop={!hideActionBar}>
        <code className={`language-${language}`} ref={ref}>
          {children}
        </code>
      </PreContainer>
    </Fragment>
  );
}
