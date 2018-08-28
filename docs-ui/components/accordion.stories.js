import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import Accordion from 'app/components/accordion';

storiesOf('Accordion', module)
  .add(
    'default',
    withInfo('An accordion button that will expand stuff.')(() => (
      <Accordion labelClosed="Show/Hide some stuff">
        <input
          type="text"
          style={{width: '100%', padding: '0.5em', margin: '0.5em 0'}}
          placeholder="field 1"
          key="0"
        />
        <input
          type="text"
          style={{width: '100%', padding: '0.5em', margin: '0.5em 0'}}
          placeholder="field 2"
          key="1"
        />
        <input
          type="text"
          style={{width: '100%', padding: '0.5em', margin: '0.5em 0'}}
          placeholder="field 3"
          key="2"
        />
      </Accordion>
    ))
  )
  .add(
    'with a cutoff',
    withInfo(
      'If you give it a cutoff, it will auto-expand the part of the array before the cutoff'
    )(() => (
      <Accordion
        labelClosed="Show me even more of these inputs"
        labelOpen="Show me considerably less of these inputs"
        cutoff={3}
      >
        <input
          type="text"
          style={{width: '100%', padding: '0.5em', margin: '0.5em 0'}}
          placeholder="field 1"
          key="0"
        />
        <input
          type="text"
          style={{width: '100%', padding: '0.5em', margin: '0.5em 0'}}
          placeholder="field 2"
          key="1"
        />
        <input
          type="text"
          style={{width: '100%', padding: '0.5em', margin: '0.5em 0'}}
          placeholder="field 3"
          key="3"
        />
        <input
          type="text"
          style={{width: '100%', padding: '0.5em', margin: '0.5em 0'}}
          placeholder="field 4"
          key="4"
        />
        <input
          type="text"
          style={{width: '100%', padding: '0.5em', margin: '0.5em 0'}}
          placeholder="field 5"
          key="5"
        />
        <input
          type="text"
          style={{width: '100%', padding: '0.5em', margin: '0.5em 0'}}
          placeholder="field 6"
          key="6"
        />
      </Accordion>
    ))
  );
