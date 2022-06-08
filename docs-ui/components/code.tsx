// eslint-disable-next-line simple-import-sort/imports
import 'prismjs/themes/prism.css';

import {createRef, RefObject, useEffect, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import copy from 'copy-text-to-clipboard';
import Prism from 'prismjs';
/**
 * JSX syntax for Prism. This file uses Prism
 * internally, so it must be imported after Prism.
 */
import 'prismjs/components/prism-jsx.min';

import {IconCode} from 'sentry/icons';
import space from 'sentry/styles/space';
import {Theme} from 'sentry/utils/theme';

type Props = {
  /**
   * Main code content gets passed as the children prop
   */
  children: string;
  /**
   * Auto-generated class name for <pre> and <code> element,
   * with a 'language-' prefix, e.g. language-css
   */
  className?: string;
  /**
   *  Meta props from the markdown syntax,
   *  for example, in
   *
   * ```jsx label=hello
   * [some code]
   * ```
   *
   * the label prop is set to 'hello'
   */
  label?: string;
  theme?: Theme;
};

const Code = ({children, className, label}: Props) => {
  const theme = useTheme();
  const codeRef: RefObject<HTMLElement> = createRef();
  const copyTimeoutRef = useRef<number | undefined>(undefined);

  const [copied, setCopied] = useState(false);

  function handleCopyCode() {
    // Remove comments from code
    const copiableContent = children.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');

    copy(copiableContent);
    setCopied(true);

    copyTimeoutRef.current = window.setTimeout(() => {
      setCopied(false);
    }, 500);
  }

  // Cleanup timeout on component unmount
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    Prism.highlightElement(codeRef.current, false);
  }, [children]);

  return (
    <Wrap className={className}>
      <LabelWrap>
        <IconCode theme={theme} color="subText" />
        {label && <Label>{label.replaceAll('_', ' ')}</Label>}
      </LabelWrap>
      <HighlightedCode className={className} ref={codeRef}>
        {children}
      </HighlightedCode>
      <CopyButton onClick={handleCopyCode} disabled={copied}>
        {copied ? 'Copied' : 'Copy'}
      </CopyButton>
    </Wrap>
  );
};

export default Code;

const Wrap = styled('pre')`
  /* Increase specificity to override default styles */
  && {
    position: relative;
    padding: ${space(2)};
    padding-top: ${space(4)};
    margin-top: ${space(4)};
    margin-bottom: ${space(2)};
    background: ${p => p.theme.bodyBackground};
    border: solid 1px ${p => p.theme.border};
    overflow: visible;
    text-shadow: none;
  }
  & code {
    text-shadow: none;
  }

  /* Overwrite default Prism behavior to allow for code wrapping */
  pre[class*='language-'],
  code[class*='language-'] {
    white-space: normal;
    word-break: break-word;
  }
`;

const LabelWrap = styled('div')`
  display: flex;
  align-items: center;
  position: absolute;
  top: 0;
  left: calc(${space(2)} - ${space(1)});
  transform: translateY(-50%);
  padding: ${space(0.25)} ${space(1)};
  background: ${p => p.theme.docsBackground};
  border: solid 1px ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;

const Label = styled('p')`
  font-size: 0.875rem;
  font-weight: 600;
  color: ${p => p.theme.subText};
  text-transform: uppercase;
  margin-bottom: 0;
  margin-left: ${space(1)};
`;

const HighlightedCode = styled('code')`
  /** Increase specificity to override default styles */
  ${/* sc-selector */ Wrap} > & {
    font-family: ${p => p.theme.text.familyMono};
    font-size: 0.875rem;
    line-height: 1.6;
  }
`;

const CopyButton = styled('button')`
  position: absolute;
  top: ${space(0.5)};
  right: ${space(0.5)};
  background: transparent;
  border: none;
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(0.5)} ${space(1)};

  font-size: 0.875rem;
  font-weight: 600;
  color: ${p => p.theme.subText};

  &:hover:not(:disabled) {
    color: ${p => p.theme.textColor};
  }
`;
