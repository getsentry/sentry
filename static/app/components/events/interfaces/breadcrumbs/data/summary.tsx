import styled from '@emotion/styled';

import ContextData from 'app/components/contextData';
import space from 'app/styles/space';

type Props = {
  children: React.ReactNode;
  kvData?: Record<string, any>;
};

function Summary({kvData, children}: Props) {
  if (!kvData || !Object.keys(kvData).length) {
    if (!children) {
      return null;
    }

    return (
      <Wrapper>
        <StyledCode>{children}</StyledCode>
      </Wrapper>
    );
  }

  return (
    <Wrapper withBackground>
      <ContextData data={kvData} withAnnotatedText>
        {children ? <StyledCode>{children}</StyledCode> : null}
      </ContextData>
    </Wrapper>
  );
}

export default Summary;

const Wrapper = styled('div')<{withBackground?: boolean}>`
  max-height: 100%;
  height: 100%;
  word-break: break-all;
  word-wrap: break-word;
  font-size: ${p => p.theme.fontSizeSmall};
  ${p =>
    p.withBackground &&
    `
      padding: ${space(1)};
      background: #f7f8f9;
      border-radius: ${p.theme.borderRadius};
    `}

  pre {
    margin: 0;
    padding: 0;
    overflow: hidden;
    overflow-y: auto;
    max-height: 100%;
  }
`;

const StyledCode = styled('code')`
  line-height: 26px;
  color: inherit;
  font-size: inherit;
  white-space: pre-wrap;
  background: none;
`;
