import 'prism-sentry/index.css';

import {Fragment, useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import Prism from 'prismjs';

import Tooltip from 'sentry/components/tooltip';
import {IconCopy} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';

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
        <code ref={ref} className={`language-${language}`}>
          {children}
        </code>
      </PreContainer>
    </Fragment>
  );
}

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

// code blocks are globally styled by `prism-sentry`
// its design tokens are slightly different than the app
// so we've left it in charge of colors while overriding
// css that breaks the experience
const CodeContainerActionBar = styled(({children, ...props}) => (
  <div {...props}>
    <pre className="language-">{children}</pre>
  </div>
))`
  pre.language- {
    display: flex;
    justify-content: end;
    gap: ${space(1)};
    padding: ${space(1.5)};
    margin-bottom: 0px;
    border-bottom: 1px solid ${p => p.theme.purple200};
    border-radius: ${p => p.theme.borderRadiusTop};
    font-size: ${p => p.theme.fontSizeSmall};
  }
`;
