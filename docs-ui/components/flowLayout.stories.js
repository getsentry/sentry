import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import FlowLayout from 'app/components/flowLayout';
import SpreadLayout from 'app/components/spreadLayout';

storiesOf('Deprecated|ComponentLayouts/FlowLayout', module)
  .add(
    'row',
    withInfo('Horizontal row with vertical centering')(() => (
      <FlowLayout style={{backgroundColor: '#fff'}}>
        <div style={{padding: 6, backgroundColor: 'rgba(0, 0, 0, 0.2)'}}>Flow</div>
        <div style={{padding: 12, backgroundColor: 'rgba(0, 0, 0, 0.1)'}}>Layout</div>
        <div style={{padding: 24, backgroundColor: 'rgba(0, 0, 0, 0.05)'}}>Flow</div>
        <div style={{padding: 18, backgroundColor: 'rgba(0, 0, 0, 0.3)'}}>Layout</div>
      </FlowLayout>
    ))
  )
  .add(
    'column',
    withInfo('Vertical column with horizontal centering')(() => (
      <FlowLayout vertical style={{backgroundColor: '#fff'}}>
        <div style={{padding: 6, backgroundColor: 'rgba(0, 0, 0, 0.2)'}}>Flow</div>
        <div style={{padding: 12, backgroundColor: 'rgba(0, 0, 0, 0.1)'}}>Layout</div>
        <div style={{padding: 24, backgroundColor: 'rgba(0, 0, 0, 0.05)'}}>Flow</div>
        <div style={{padding: 18, backgroundColor: 'rgba(0, 0, 0, 0.3)'}}>Layout</div>
      </FlowLayout>
    ))
  )
  .add(
    'long content (truncate)',
    withInfo(
      'When you use <FlowLayout> with content that does not get wrapped and overflows, by default hide overflow.'
    )(() => (
      <div>
        <h3 style={{marginBottom: 0, marginTop: 24}}>With "truncate"</h3>
        <SpreadLayout style={{backgroundColor: 'white', width: 250}}>
          <FlowLayout truncate={true}>
            <span className="truncate" style={{whiteSpace: 'nowrap'}}>
              Very very long content Very very long content Very very long content Very
              very long content
            </span>
          </FlowLayout>

          <div style={{backgroundColor: '#ccc'}}>Important</div>
        </SpreadLayout>

        <h3 style={{marginBottom: 0, marginTop: 24}}>Without "truncate"</h3>
        <SpreadLayout style={{backgroundColor: 'white', width: 250}}>
          <FlowLayout truncate={false}>
            <span className="truncate" style={{whiteSpace: 'nowrap'}}>
              Very very long content Very very long content Very very long content Very
              very long content
            </span>
          </FlowLayout>

          <div style={{backgroundColor: '#ccc'}}>Important</div>
        </SpreadLayout>
      </div>
    ))
  );
