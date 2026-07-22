import {Fragment} from 'react';
import styled from '@emotion/styled';

import zeroInboxIssuesImg from 'sentry-images/spot/zero-inbox-issues.svg';

import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

function Message({title, subtitle}: {subtitle: React.ReactNode; title: React.ReactNode}) {
  return (
    <Fragment>
      <EmptyMessage as="div" size={{zero: 'md', sm: 'xl'}}>
        {title}
      </EmptyMessage>
      <Text as="p" size="md">
        {subtitle}
      </Text>
    </Fragment>
  );
}

type Props = {
  subtitle: React.ReactNode;
  title: React.ReactNode;
};

export function NoUnresolvedIssues({title, subtitle}: Props) {
  return (
    <Wrapper direction="column" align="center">
      <img src={zeroInboxIssuesImg} alt="No issues found spot illustration" />
      <Message title={title} subtitle={subtitle} />
    </Wrapper>
  );
}

const Wrapper = styled(Flex)`
  padding: ${p => p.theme.space['3xl']} ${p => p.theme.space['3xl']};
  text-align: center;
  color: ${p => p.theme.tokens.content.secondary};
`;

const EmptyMessage = styled(Text)`
  font-weight: ${p => p.theme.font.weight.sans.medium};
`;
