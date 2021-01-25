import React from 'react';

import {
  addErrorMessage,
  addMessage,
  addSuccessMessage,
} from 'app/actionCreators/indicator';
import Button from 'app/components/button';
import IndicatorContainer, {Indicators} from 'app/components/indicators';
import IndicatorStore from 'app/stores/indicatorStore';

export default {
  title: 'UI/Toast Indicators',
};

export const Static = ({type}) => {
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
};

Static.storyName = 'static';
Static.args = {
  type: 'success',
};
Static.argTypes = {
  type: {
    control: {
      type: 'select',
      options: ['success', 'error', 'loading'],
    },
  },
};

export const Interactive = () => {
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
};

Interactive.storyName = 'interactive';
