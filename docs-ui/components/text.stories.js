import {withInfo} from '@storybook/addon-info';

import Text from 'app/components/text';

export default {
  title: 'Core/Style/Text',
};

export const Default = withInfo('On-demand styling for native dom elements')(() => (
  <div style={{padding: 20, backgroundColor: '#ffffff'}}>
    <Text>
      <h1>Text styles</h1>
      <p>
        Not having to override margin, padding, and line-height on native text elements is
        a feature in the app UI world — that's why things like reset.css, normalize.css,
        etc exist. But in situations where you need those styles to "just work" it can be
        quite frustrating to find out they're not supported.
      </p>

      <h2>Introducing the Text component</h2>

      <p>
        The Text component unlocks basic type styles on native text components on-demand
        in a way that's simple, familiar, and easy to remember. Here are the components it
        supports:
      </p>

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

      <h3>Lists</h3>
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

      <h3>Blockquote</h3>

      <blockquote>
        LOL have you ever tried to quote something in the app? Who cares, it's supported.
      </blockquote>

      <p>
        That's it for now. You'll notice that there's no margin doubling up with the
        padding of this container. That's because the last child in a Text component has{' '}
        <code>margin-bottom: 0</code>. Byyyeeee.
      </p>
    </Text>
  </div>
));

Default.story = {
  name: 'default',
};
