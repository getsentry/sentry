import React from 'react';
import {withInfo} from '@storybook/addon-info';

import NotAvailable from 'app/components/notAvailable';
import PanelTable from 'app/components/panels/panelTable';

export default {
  title: 'Core/Tables/NotAvailable',
};

export const Default = withInfo(
  "When you don't have data to display in a table's column, but don't want to display an empty space."
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
