import styled from '@emotion/styled';

import {CodeSnippet} from 'sentry/components/codeSnippet';

const RelocationCodeBlock = styled(CodeSnippet)`
  margin: ${p => p.theme.space(2)} 0 ${p => p.theme.space(4)};
  padding: 4px;
`;

export default RelocationCodeBlock;
