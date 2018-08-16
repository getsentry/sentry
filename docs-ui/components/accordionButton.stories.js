import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import AccordionButton from 'app/components/accordionButton';

storiesOf('Tags', module)
  .add(
    'default',
    withInfo(
      'An accordion button. It uses an <a> tag to not interfere with form focus'
    )(() => <AccordionButton>Show me more fields</AccordionButton>)
  )
  .add(
    'with a counter',
    withInfo('you can give a hint of what is inside using a counter')(() => (
      <AccordionButton count={11}>Show me more fields</AccordionButton>
    ))
  );
