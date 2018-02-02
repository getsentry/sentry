import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';
import {select} from '@storybook/addon-knobs';

import IndicatorContainer, {Indicators} from 'sentry-ui/indicators';
import IndicatorStore from 'application-root/stores/indicatorStore';
import Button from 'sentry-ui/buttons/button';

const stories = storiesOf('Toast Indicators', module);
stories
  .add(
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
  )
  .add(
    'interactive',
    withInfo('Toast Indicators')(() => {
      let success;
      let error;

      return (
        <div style={{backgroundColor: 'white', padding: 12}}>
          <Button
            onClick={() => {
              if (success) {
                IndicatorStore.remove(success);
                success = null;
              } else {
                success = IndicatorStore.addSuccess('Success');
              }
            }}
          >
            Toggle Success
          </Button>
          <Button
            onClick={() => {
              if (error) {
                IndicatorStore.remove(error);
                error = null;
              } else {
                error = IndicatorStore.addError('Error');
              }
            }}
          >
            Toggle Error
          </Button>
          <IndicatorContainer />
        </div>
      );
    })
  );
