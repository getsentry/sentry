import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';
import {select} from '@storybook/addon-knobs';

import {Indicators} from 'sentry-ui/indicators';

const stories = storiesOf('Toast Indicators', module);
stories.add(
  'static',
  withInfo('Toast Indicators')(() => {
    let type = select(
      'Type',
      {success: 'success', error: 'error', loading: 'loading'},
      'success'
    );

    return (
      <div style={{backgroundColor: 'white', padding: 12}}>
        <Indicators
          items={[
            {
              id: '',
              type,
              message: 'Indicator message',
            },
          ]}
        />
      </div>
    );
  })
);
