import * as React from 'react';
import styled from '@emotion/styled';

import ListItem from 'sentry/components/list/listItem';
import space from 'sentry/styles/space';

type Props = {
  children: React.ReactNode;
  description: string;
  title: string;
  required?: boolean;
};

function BuildStep({title, description, required = false, children}: Props) {
  return (
    <Wrapper>
      <Header>
        <Heading>
          {title}
          {required && <RequiredBadge />}
        </Heading>
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
  margin-bottom: 0;
  color: ${p => p.theme.gray500};
`;

const SubHeading = styled('small')`
  color: ${p => p.theme.gray300};
`;

const Content = styled('div')`
  display: grid;
`;

const RequiredBadge = styled('div')`
  background: ${p => p.theme.red300};
  opacity: 0.6;
  width: 5px;
  height: 5px;
  border-radius: 5px;
  margin-left: ${space(0.5)};
  display: inline-block;
  vertical-align: super;
`;
