import {withTheme} from '@emotion/react';
import styled from '@emotion/styled';
import copy from 'copy-text-to-clipboard';
import Prism from 'prismjs';
import 'prismjs/themes/prism.css';
import {Component, createRef, RefObject, useEffect} from 'react';

import {IconCode} from 'app/icons';
import space from 'app/styles/space';
import {Theme} from 'app/utils/theme';

type Props = {
  theme: Theme;
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
};

const Code = ({theme, children, className, label}: Props) => {
  const codeRef: RefObject<HTMLElement> = createRef();
  const copyButtonRef: RefObject<HTMLButtonElement> = createRef();

  function copyCode() {
    const copyButton = copyButtonRef?.current;

    if (copyButton) {
      /** Remove comments from code */
      const copiableContent = children.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');

      copy(copiableContent);

      copyButton.innerText = 'Copied';
      copyButton.disabled = true;

      setTimeout(() => {
        copyButton.innerText = 'Copy';
        copyButton.disabled = false;
      }, 500);
    }
  }

  useEffect(() => {
    Prism.highlightElement(codeRef.current, true);
  });

  return (
    <Wrap className={className}>
      <LabelWrap>
        <IconCode theme={theme} color="gray300" />
        {label && <Label>{label.replaceAll('_', ' ')}</Label>}
      </LabelWrap>
      <HighlightedCode className={className} ref={codeRef}>
        {children}
      </HighlightedCode>
      <CopyButton ref={copyButtonRef} onClick={() => copyCode()}>
        Copy
      </CopyButton>
    </Wrap>
  );
};

export default withTheme(Code);

const Wrap = styled('pre')`
  /** Increase specificity to override default styles */
  && {
    position: relative;
    padding: ${space(2)};
    padding-top: ${space(3)};
    margin-top: ${space(4)};
    margin-bottom: ${space(2)};
    background: ${p => p.theme.bodyBackground};
    border: solid 1px ${p => p.theme.gray100};
    overflow: visible;
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
  background: ${p => p.theme.white};
  border: solid 1px ${p => p.theme.gray100};
  border-radius: ${p => p.theme.borderRadius};
`;

const Label = styled('p')`
  font-size: 0.875rem;
  font-weight: 600;
  color: ${p => p.theme.gray300};
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
  color: ${p => p.theme.gray300};

  &:hover:not(:disabled) {
    color: ${p => p.theme.gray500};
  }
`;
