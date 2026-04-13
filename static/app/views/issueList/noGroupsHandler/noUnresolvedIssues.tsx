import {Fragment} from 'react';
import styled from '@emotion/styled';

import zeroInboxIssuesImg from 'sentry-images/spot/zero-inbox-issues.svg';

function Message({title, subtitle}: {subtitle: React.ReactNode; title: React.ReactNode}) {
  return (
    <Fragment>
      <EmptyMessage>{title}</EmptyMessage>
      <p>{subtitle}</p>
    </Fragment>
  );
}

type Props = {
  subtitle: React.ReactNode;
  title: React.ReactNode;
};

export function NoUnresolvedIssues({title, subtitle}: Props) {
  return (
    <Wrapper>
      <img src={zeroInboxIssuesImg} alt="No issues found spot illustration" />
      <Message title={title} subtitle={subtitle} />
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  display: flex;
  padding: ${p => p.theme.space['3xl']} ${p => p.theme.space['3xl']};
  flex-direction: column;
  align-items: center;
  text-align: center;
  color: ${p => p.theme.tokens.content.secondary};

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    font-size: ${p => p.theme.font.size.md};
  }
`;

const EmptyMessage = styled('div')`
  font-weight: ${p => p.theme.font.weight.sans.medium};

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    font-size: ${p => p.theme.font.size.xl};
  }
`;
