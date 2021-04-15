import React from 'react';
import styled from '@emotion/styled';

import ListItem from 'app/components/list/listItem';
import space from 'app/styles/space';

type Props = {
  title: string;
  description: string;
  children: React.ReactNode;
};

function BuildStep({title, description, children}: Props) {
  return (
    <StyledListItem>
      <Header>
        <Description>{title}</Description>
        <SubDescription>{description}</SubDescription>
      </Header>
      <Content>{children}</Content>
    </StyledListItem>
  );
}

export default BuildStep;

const StyledListItem = styled(ListItem)`
  display: grid;
  grid-gap: ${space(2)};
`;

const Description = styled('h4')`
  font-weight: 400;
  margin-bottom: 0;
`;

const SubDescription = styled('div')`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeMedium};
`;

const Header = styled('div')`
  display: grid;
  grid-gap: ${space(0.5)};
`;

const Content = styled('div')`
  display: grid;
  grid-template-columns: 1fr max-content;
`;
