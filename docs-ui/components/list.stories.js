import React from 'react';
import {withInfo} from '@storybook/addon-info';

import {IconBusiness} from 'app/icons/iconBusiness';
import {List, ListItem} from 'app/components/list';

export default {
  title: 'Core/List',
};

export const Default = withInfo('Default message goes here')(() => (
  <React.Fragment>
    <List>
      <ListItem>Item 1</ListItem>
      <ListItem>Item 2</ListItem>
      <ListItem>Item 3</ListItem>
    </List>
    <List>
      <ListItem icon={<IconBusiness color="orange400" size="sm" />}>Item 1</ListItem>
      <ListItem icon={<IconBusiness color="orange400" size="sm" />}>Item 2</ListItem>
      <ListItem icon={<IconBusiness color="orange400" size="sm" />}>Item 3</ListItem>
    </List>
    <List as="ol">
      <ListItem>Item 1</ListItem>
      <ListItem>Item 2</ListItem>
      <ListItem>Item 3</ListItem>
    </List>
  </React.Fragment>
));
