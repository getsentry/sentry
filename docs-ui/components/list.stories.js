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
        <ListItem>Lol</ListItem>
        <ListItem>Lol</ListItem>
        <ListItem>Lol</ListItem>
        <ListItem>Lol</ListItem>
      </List>
      <List>
        <ListItem icon={<IconDelete size="xs" />}>Lol</ListItem>
      </List>
      <List as="ol">
        <ListItem>Lol</ListItem>
      </List>
    </React.Fragment>
  ))
);
