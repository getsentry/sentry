import styled from '@emotion/styled';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import {space} from 'sentry/styles/space';

const RelocationCodeBlock = styled(CodeSnippet)`
  margin: ${space(2)} 0 ${space(4)};
  padding: 4px;
`;

export default RelocationCodeBlock;
