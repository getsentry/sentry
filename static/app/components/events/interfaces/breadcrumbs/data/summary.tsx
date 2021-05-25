import {Fragment} from 'react';
import styled from '@emotion/styled';

import ContextData from 'app/components/contextData';

type Props = {
  children: React.ReactNode;
  onToggle: () => void;
  kvData?: Record<string, any>;
};

function Summary({kvData, children, onToggle}: Props) {
  function renderKvData() {
    if (!kvData || !Object.keys(kvData).length) {
      return null;
    }

    return <ContextData data={kvData} onToggle={onToggle} withAnnotatedText />;
  }

  return (
    <Fragment>
      <StyledPre>
        <StyledCode>{children}</StyledCode>
        {renderKvData()}
      </StyledPre>
    </Fragment>
  );
}

export default Summary;

const StyledPre = styled('pre')`
  padding: 0;
  background: none;
  box-sizing: border-box;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
  font-size: ${p => p.theme.fontSizeSmall};
`;

const StyledCode = styled('code')`
  white-space: pre-wrap;
  line-height: 26px;
`;
