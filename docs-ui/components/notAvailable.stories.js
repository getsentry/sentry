import React from 'react';
import {withInfo} from '@storybook/addon-info';

import NotAvailable from 'app/components/notAvailable';
import PanelTable from 'app/components/panels/panelTable';

export default {
  title: 'Core/NotAvailable',
};

export const Default = withInfo(
  "When you don't have data to display, but don't want to display an empty space. It's commonly used in a table."
)(() => (
  <div>
    <div className="section">
      <h3>Alone</h3>
      <NotAvailable />
    </div>
    <div className="section">
      <h3>In a Table</h3>
      <PanelTable headers={['Header #1', 'Header #2']}>
        <div>Panel Item with really long content</div>
        <div>
          <NotAvailable />
        </div>
      </PanelTable>
    </div>
  </div>
));

Default.story = {
  name: 'default',
};
