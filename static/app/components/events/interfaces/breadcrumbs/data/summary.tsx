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
    <Wrapper>
      {children && <StyledCode>{children}</StyledCode>}
      <ContextDataWrapper>
        <ContextData data={kvData} withAnnotatedText />
      </ContextDataWrapper>
    </Wrapper>
  );
}

export default Summary;

const Wrapper = styled('div')`
  max-height: 100%;
  height: 100%;
  word-break: break-all;
  font-size: ${p => p.theme.fontSizeSmall};
  font-family: ${p => p.theme.text.familyMono};
  display: grid;
  grid-gap: ${space(0.5)};
`;

const ContextDataWrapper = styled('div')`
  padding: ${space(1)};
  background: ${p => p.theme.backgroundSecondary};
  border-radius: ${p => p.theme.borderRadius};
  max-height: 100%;
  height: 100%;
  overflow: hidden;

  pre {
    background: ${p => p.theme.backgroundSecondary};
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
  padding: 0;
`;
