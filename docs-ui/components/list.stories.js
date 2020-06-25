import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import {IconDelete} from 'app/icons/iconDelete';
import {List, ListItem} from 'app/components/list';

storiesOf('UI|List', module).add(
  'Default',
  withInfo('Default message goes here')(() => (
    <React.Fragment>
      <List>
        <ListItem>Item 1</ListItem>
        <ListItem>Item 2</ListItem>
        <ListItem>Item 3</ListItem>
      </List>
      <List>
        <ListItem icon={<IconDelete size="xs" />}>Item 1</ListItem>
        <ListItem icon={<IconDelete size="xs" />}>Item 2</ListItem>
        <ListItem icon={<IconDelete size="xs" />}>Item 3</ListItem>
      </List>
      <List as="ol">
        <ListItem>Item 1</ListItem>
        <ListItem>Item 2</ListItem>
        <ListItem>Item 3</ListItem>
      </List>
    </React.Fragment>
  ))
);
