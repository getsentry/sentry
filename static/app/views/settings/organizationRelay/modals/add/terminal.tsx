import styled from '@emotion/styled';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import {space} from 'sentry/styles/space';

type Props = {
  command: string;
};

function Terminal({command}: Props) {
  return <StyledCodeSnippet language="bash">{command}</StyledCodeSnippet>;
}

export default Terminal;

const StyledCodeSnippet = styled(CodeSnippet)`
  padding-left: ${space(2)};
  &:before {
    content: '\u0024';
    position: absolute;
    padding-top: ${space(1)};
    color: var(--prism-comment);
    font-size: ${p => p.theme.codeFontSize};
  }
`;
