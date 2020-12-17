import React from 'react';
import {withInfo} from '@storybook/addon-info';

export default {
  title: 'Core/Style/Text',
};

export const Default = withInfo('On-demand styling for native dom elements')(() => (
  <div style={{padding: 20, backgroundColor: '#ffffff'}}>
    <h1>Text styles</h1>

    <h2>Headings</h2>

    <p>Headings are styled as they should be. Here's a quick sampling:</p>

    <h1>This is a H1 heading</h1>
    <h2>This is a H2 heading</h2>
    <h3>This is a H3 heading</h3>
    <h4>This is a H4 heading</h4>
    <h5>This is a H5 heading</h5>
    <h6>This is a H6 heading</h6>

    <h2>Paragraph</h2>

    <p>
      Paragraphs are essential to communicating complex ideas to our users. However, we
      can't rely on them alone.
    </p>

    <h2>Lists</h2>
    <p>Lists are a goto when it comes to conveying complex ideas. Unordered lists:</p>
    <ul>
      <li>
        Help chunk out larger ideas into bite size pieces that are a little easier to
        consume
      </li>
      <li>Make it easy for a user to scan text for key information</li>
      <li>Help break up walls of text</li>
    </ul>

    <p>Ordered lists:</p>

    <ol>
      <li>Are</li>
      <li>great</li>
      <li>too</li>
    </ol>

    <h2>Blockquote</h2>

    <blockquote>
      LOL have you ever tried to quote something in the app? Who cares, it's supported.
    </blockquote>

    <p>
      That's it for now. You'll notice that there's no margin doubling up with the padding
      of this container. That's because the last child has <code>margin-bottom: 0</code>.
      Byyyeeee.
    </p>
  </div>
));

Default.story = {
  name: 'default',
};
