import {Fragment} from 'react';
import styled from '@emotion/styled';

import zeroInboxIssuesImg from 'sentry-images/spot/zero-inbox-issues.svg';

import {space} from 'sentry/styles/space';

const Message = ({
  title,
  subtitle,
}: {
  subtitle: React.ReactNode;
  title: React.ReactNode;
}) => (
  <Fragment>
    <EmptyMessage>{title}</EmptyMessage>
    <p>{subtitle}</p>
  </Fragment>
);

type Props = {
  subtitle: React.ReactNode;
  title: React.ReactNode;
};

const NoUnresolvedIssues = ({title, subtitle}: Props) => (
  <Wrapper>
    <img src={zeroInboxIssuesImg} alt="No issues found spot illustration" />
    <Message title={title} subtitle={subtitle} />
  </Wrapper>
);

const Wrapper = styled('div')`
  display: flex;
  padding: ${space(4)} ${space(4)};
  flex-direction: column;
  align-items: center;
  text-align: center;
  color: ${p => p.theme.subText};

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    font-size: ${p => p.theme.fontSizeMedium};
  }
`;

const EmptyMessage = styled('div')`
  font-weight: 600;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    font-size: ${p => p.theme.fontSizeExtraLarge};
  }
`;

export default NoUnresolvedIssues;
