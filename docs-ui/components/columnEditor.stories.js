import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';
import {action} from '@storybook/addon-actions';

import ColumnEditRow from 'app/views/eventsV2/table/columnEditRow';

storiesOf('Discover|ColumnEditor', module).add(
  'all',
  withInfo({
    text: 'Playground for building out column editor v2 for discover',
  })(() => {
    const organization = {
      slug: 'test-org',
      features: ['transaction-events'],
    };
    const tags = ['browser.name', 'custom-field'];

    const simple = {
      field: 'event.type',
    };
    const simpleTag = {
      field: 'browser.name',
    };
    const aggregateField = {
      field: 'id',
      aggregation: 'count',
    };

    return (
      <div>
        <h3>Basic field</h3>
        <ColumnEditRow
          organization={organization}
          column={simple}
          tagKeys={tags}
          onChange={action('onchange')}
          parentIndex={0}
        />

        <h3>Tag field</h3>
        <ColumnEditRow
          organization={organization}
          column={simpleTag}
          tagKeys={tags}
          onChange={action('onchange')}
          parentIndex={0}
        />

        <h3>Aggregate field</h3>
        <ColumnEditRow
          organization={organization}
          column={aggregateField}
          tagKeys={tags}
          onChange={action('onchange')}
          parentIndex={0}
        />
      </div>
    );
  })
);
