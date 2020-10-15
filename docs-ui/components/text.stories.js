import React from 'react';
import {withInfo} from '@storybook/addon-info';

export default {
  title: 'Core/Style/Text',
};

export const Default = withInfo('On-demand styling for native dom elements')(() => (
  <div style={{padding: 20, backgroundColor: '#ffffff'}}>
    <h1>Text styles</h1>

    <h3>Headings</h3>

    <p>Headings are styled as they should be. Here's a quick sampling:</p>

    <h1>This is a H1 heading</h1>
    <h2>This is a H2 heading</h2>
    <h3>This is a H3 heading</h3>
    <h4>This is a H4 heading</h4>
    <h5>This is a H5 heading</h5>
    <h6>This is a H6 heading</h6>

    <h3>Paragraph</h3>

    <p>
      Paragraphs are essential to communicating complex ideas to our users. However, we
      can't rely on them alone.
    </p>

    <h3>Blockquote</h3>

    <blockquote>
      LOL have you ever tried to quote something in the app? Who cares, it's supported.
    </blockquote>
  </div>
));

Default.story = {
  name: 'default',
};
