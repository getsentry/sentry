import styled from '@emotion/styled';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import space from 'sentry/styles/space';

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
};

const Code = ({children, className, label}: Props) => {
  return (
    <CodeWrap className={className}>
      <LabelWrap>{label && <Label>{label.replaceAll('_', ' ')}</Label>}</LabelWrap>
      <CodeSnippet language={className?.split('language-')[1] ?? ''}>
        {children}
      </CodeSnippet>
    </CodeWrap>
  );
};

export default Code;

const CodeWrap = styled('div')`
  position: relative;
  padding: ${space(2)} 0;

  pre {
    font-size: ${p => p.theme.fontSizeMedium};
    border: solid 1px ${p => p.theme.border};
    padding-top: ${space(2)};
  }
`;

const LabelWrap = styled('div')`
  display: flex;
  align-items: center;
  position: absolute;
  top: ${space(2)};
  left: calc(${space(2)} - ${space(1)});
  transform: translateY(-50%);
  z-index: 1;

  padding: 0 ${space(0.75)};
  background: ${p => p.theme.docsBackground};
  border: solid 1px ${p => p.theme.innerBorder};
  border-radius: ${p => p.theme.borderRadius};
`;

const Label = styled('p')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: 600;

  text-transform: uppercase;
  margin-bottom: 0;
`;
