import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';
import {select} from '@storybook/addon-knobs';

import IndicatorContainer, {Indicators} from 'sentry-ui/indicators';
import IndicatorStore from 'application-root/stores/indicatorStore';
import {
  addSuccessMessage,
  addErrorMessage,
  addMessage,
} from 'application-root/actionCreators/indicator';
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
