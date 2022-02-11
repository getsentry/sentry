import * as React from 'react';
import styled from '@emotion/styled';

import ListItem from 'sentry/components/list/listItem';
import space from 'sentry/styles/space';

type Props = {
  children: React.ReactNode;
  description: string;
  title: string;
};

function BuildStep({title, description, children}: Props) {
  return (
    <Wrapper>
      <Header>
        <Heading>{title}</Heading>
        <SubHeading>{description}</SubHeading>
      </Header>
      <Content>{children}</Content>
    </Wrapper>
  );
}

export default BuildStep;

const Wrapper = styled(ListItem)`
  display: grid;
  gap: ${space(2)};
`;

const Header = styled('div')`
  display: grid;
  gap: ${space(0.25)};
`;

const Heading = styled('h5')`
  font-weight: 500;
  margin-bottom: 0;
  color: ${p => p.theme.gray500};
`;

const SubHeading = styled('small')`
  color: ${p => p.theme.gray300};
`;

const Content = styled('div')`
  display: grid;
  grid-template-columns: 1fr max-content;
`;
