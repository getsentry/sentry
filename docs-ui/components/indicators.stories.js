import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';
import {select} from '@storybook/addon-knobs';

import IndicatorContainer, {Indicators} from 'app/components/indicators';
import IndicatorStore from 'app/stores/indicatorStore';
import {
  addSuccessMessage,
  addErrorMessage,
  addMessage,
} from 'app/actionCreators/indicator';
import Button from 'app/components/button';

storiesOf('UI|Toast Indicators', module)
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
    withInfo({
      propTablesExclude: [Button],
      text: 'Toast Indicators',
    })(() => {
      let success;
      let error;
      let loading;

      return (
        <div style={{backgroundColor: 'white', padding: 12}}>
          <Button
            onClick={() => {
              if (success) {
                IndicatorStore.remove(success);
                success = null;
              } else {
                success = addSuccessMessage('Success');
              }
            }}
          >
            Toggle Success
          </Button>
          <Button
            onClick={() => {
              if (loading) {
                IndicatorStore.remove(loading);
                loading = null;
              } else {
                loading = addMessage('Loading', 'loading');
              }
            }}
          >
            Toggle Loading
          </Button>
          <Button
            onClick={() => {
              if (error) {
                IndicatorStore.remove(error);
                error = null;
              } else {
                error = addErrorMessage('Error');
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
