import { Fragment } from 'react';
import {withInfo} from '@storybook/addon-info';

import {IconBusiness, IconTelescope, IconLightning, IconSiren} from 'app/icons';
import List from 'app/components/list';
import ListItem from 'app/components/list/listItem';

export default {
  title: 'Core/List',
};

export const Default = withInfo('Default message goes here')(() => (
  <Fragment>
    <div className="section">
      <h4>Without Symbol</h4>
      <List>
        <ListItem>Item 1</ListItem>
        <ListItem>Item 2</ListItem>
        <ListItem>Item 3</ListItem>
      </List>
    </div>
    <div className="section">
      <h4>Bullet Symbol</h4>
      <List symbol="bullet">
        <ListItem>Item 1</ListItem>
        <ListItem>Item 2</ListItem>
        <ListItem>Item 3</ListItem>
      </List>
    </div>
    <div className="section">
      <h4>Custom Symbol</h4>
      <List symbol={<IconBusiness />}>
        <ListItem>Item 1</ListItem>
        <ListItem>Item 2</ListItem>
        <ListItem>Item 3</ListItem>
      </List>
    </div>
    <div className="section">
      <h4>Multiple Custom Symbol</h4>
      <List>
        <ListItem symbol={<IconTelescope />}>Item 1</ListItem>
        <ListItem symbol={<IconLightning />}>Item 2</ListItem>
        <ListItem symbol={<IconSiren />}>Item 3</ListItem>
      </List>
    </div>
    <div className="section">
      <h3>Numeric Symbol</h3>
      <List symbol="numeric">
        <ListItem>Item 1</ListItem>
        <ListItem>Item 2</ListItem>
        <ListItem>Item 3</ListItem>
      </List>
    </div>
    <div className="section">
      <h4>Colored Numeric Symbol</h4>
      <List symbol="colored-numeric">
        <ListItem>Item 1</ListItem>
        <ListItem>Item 2</ListItem>
        <ListItem>Item 3</ListItem>
      </List>
    </div>
  </Fragment>
));
