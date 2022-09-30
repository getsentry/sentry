import Prism from 'prismjs';

import {CodeSnippet} from 'sentry/components/codeSnippet';

export default {
  title: 'Components/Code Snippet',
  component: CodeSnippet,
};

export const Default = ({...args}) => (
  <CodeSnippet {...args}>
    {`import {x, y} as p from 'point';
const ANSWER = 42;

class Car extends Vehicle {
  constructor(speed, cost) {
    super(speed);

    var c = Symbol('cost');
    this[c] = cost;

    this.intro = \`This is a car runs at
      \$\{speed\}.\`;
  }
}`}
  </CodeSnippet>
);

Default.args = {
  filename: 'sample.js',
  language: 'javascript',
  hideCopyButton: false,
};
Default.argTypes = {
  language: {
    options: Object.keys(Prism.languages),
    control: {type: 'inline-radio'},
    description:
      'This is not a reactive prop. Changes to this prop after the intitial render will not re-trigger the Prism highlighting function.',
  },
};
