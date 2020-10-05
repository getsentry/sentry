import React from 'react';
import {withInfo} from '@storybook/addon-info';
import styled from '@emotion/styled';

import IdBadge from 'app/components/idBadge';

const Item = styled('div')`
  padding: 8px;
  background-color: white;
  border: 1px dashed #fcfcfc;
  margin-bottom: 30px;
`;
Item.displayName = 'Item';

const Header = styled('h2')`
  font-size: 18px;
  margin-bottom: 4px;
`;
Header.displayName = 'Header';

export default {
  title: 'Core/Badges+Tags/IdBadge',
};

export const All = withInfo({
  text:
    'These are identification badges for certain models in Sentry: Organization, Project, Team, and User.',
  propTablesExclude: [Item, Header, React.Fragment],
})(() => {
  const user = {
    name: 'Chrissy',
    email: 'chris.clark@sentry.io',
  };
  const team = {
    slug: 'team-slug',
  };
  const project = {
    slug: 'project-slug',
  };
  const organization = {
    slug: 'organization-slug',
  };
  const member = {
    name: 'Pending Member',
    email: 'member@example.org',
  };

  return (
    <React.Fragment>
      <Header>User Badge</Header>
      <Item>
        <IdBadge user={user} />
      </Item>
      <Header>Member Badge</Header>
      <Item>
        <IdBadge member={member} />
      </Item>
      <Header>Team Badge</Header>
      <Item>
        <IdBadge team={team} />
      </Item>
      <Header>Project Badge</Header>
      <Item>
        <IdBadge project={project} />
      </Item>
      <Header>Organization Badge</Header>
      <Item>
        <IdBadge organization={organization} />
      </Item>
    </React.Fragment>
  );
});

All.story = {
  name: 'all',
};
