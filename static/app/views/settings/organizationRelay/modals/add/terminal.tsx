import styled from '@emotion/styled';

import {CodeBlock} from 'sentry/components/core/code';
import {space} from 'sentry/styles/space';

type Props = {
  command: string;
};

function Terminal({command}: Props) {
  return <StyledCodeSnippet language="bash">{command}</StyledCodeSnippet>;
}

export default Terminal;

const StyledCodeSnippet = styled(CodeBlock)`
  padding-left: ${space(2)};
  &:before {
    content: '\0024';
    position: absolute;
    padding-top: ${space(1)};
    color: var(--prism-comment);
    font-size: ${p => p.theme.fontSize.sm};
  }
`;
