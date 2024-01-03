import styled from '@emotion/styled';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import {space} from 'sentry/styles/space';
import {SQLishFormatter} from 'sentry/views/starfish/utils/sqlish/SQLishFormatter';

import Summary from './summary';

const formatter = new SQLishFormatter();

type Props = {
  message: string;
};

export function Sql({message}: Props) {
  return (
    <Summary>
      <FormattedCode>
        <StyledCodeSnippet language="sql">
          {formatter.toString(message)}
        </StyledCodeSnippet>
      </FormattedCode>
    </Summary>
  );
}

const StyledCodeSnippet = styled(CodeSnippet)`
  pre {
    /* overflow is set to visible in global styles so need to enforce auto here */
    overflow: auto !important;
  }

  z-index: 0;
`;

const FormattedCode = styled('div')`
  padding: ${space(1)};
  background: ${p => p.theme.backgroundSecondary};
  border-radius: ${p => p.theme.borderRadius};
  overflow-x: auto;
  white-space: pre;
`;
