import styled from '@emotion/styled';

import {CodeBlock} from '@sentry/scraps/code';

type Props = {
  command: string;
};

function Terminal({command}: Props) {
  return <StyledCodeSnippet language="bash">{command}</StyledCodeSnippet>;
}

export default Terminal;

const StyledCodeSnippet = styled(CodeBlock)`
  padding-left: ${p => p.theme.space.xl};
  &:before {
    content: '\0024';
    position: absolute;
    padding-top: ${p => p.theme.space.md};
    color: var(--prism-comment);
    font-size: ${p => p.theme.font.size.sm};
  }
`;
