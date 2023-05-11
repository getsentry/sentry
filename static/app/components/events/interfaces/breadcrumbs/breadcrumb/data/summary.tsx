import styled from '@emotion/styled';

import ContextData from 'sentry/components/contextData';
import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';

type Props = {
  children: React.ReactNode;
  kvData?: Record<string, any> | null;
  meta?: Record<any, any>;
};

function Summary({kvData, children, meta}: Props) {
  if (meta?.data?.[''] && !defined(kvData)) {
    return (
      <Wrapper>
        {children && <StyledCode>{children}</StyledCode>}
        <ContextDataWrapper>
          <AnnotatedText value={kvData} meta={meta?.data?.['']} />
        </ContextDataWrapper>
      </Wrapper>
    );
  }

  if (!kvData || !Object.keys(kvData).length) {
    if (!children) {
      return <div />;
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
  word-break: break-all;
  font-size: ${p => p.theme.fontSizeSmall};
  font-family: ${p => p.theme.text.familyMono};
  overflow: hidden;
`;

const ContextDataWrapper = styled('div')`
  padding: ${space(1)};
  background: ${p => p.theme.backgroundSecondary};
  border-radius: ${p => p.theme.borderRadius};
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
  display: block;
  font-size: inherit;
  white-space: pre-wrap;
  background: none;
  padding: 0;
  margin-bottom: ${space(0.5)};

  > * {
    vertical-align: middle;
  }
`;
