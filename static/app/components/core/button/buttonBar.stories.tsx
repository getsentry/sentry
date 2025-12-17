import {Fragment, useState} from 'react';
import documentation from '!!type-loader!sentry/components/core/button/buttonBar';

import {Button, type ButtonProps} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import * as Storybook from 'sentry/stories';

export default Storybook.story('ButtonBar', (story, APIReference) => {
  APIReference(documentation.props?.ButtonBar);

  story('Default', () => {
    const [active, setActive] = useState('One');
    const [merged, setMerged] = useState('One');

    function makeProps(id: string): Partial<ButtonProps> {
      return {
        priority: active === id ? 'primary' : 'default',
        onClick: () => setActive(id),
      };
    }

    function makeMergedProps(id: string): Partial<ButtonProps> {
      return {
        priority: merged === id ? 'primary' : 'default',
        onClick: () => setMerged(id),
      };
    }

    return (
      <Fragment>
        <p>
          A <Storybook.JSXNode name="ButtonBar" /> is a component that groups related
          buttons together. It can be used in two modes: regular (with gaps between
          buttons) or merged (buttons joined together into a single control). Pass the
          'merged' prop to create a merged button group. You can also customize the gap
          size between buttons using the 'gap' prop when not merged.
        </p>
        <p>
          When using a <Storybook.JSXNode name="ButtonBar" /> with interactive buttons,
          you'll typically want to manage an active state to highlight the selected
          button. This can be done by maintaining a state variable and using it to
          conditionally set the button priority to 'primary' when active (or any other
          priority you want), as shown in the example below. The active state management
          is handled by the parent component, not the{' '}
          <Storybook.JSXNode name="ButtonBar" /> itself.
        </p>
        <ButtonBar gap="0">
          {['One', 'Two', 'Three'].map(id => (
            <Button key={id} {...makeProps(id)}>
              {id}
            </Button>
          ))}
        </ButtonBar>

        <p>
          You can also pass the 'merged' prop to the{' '}
          <Storybook.JSXNode name="ButtonBar" /> to merge the buttons together.
        </p>
        <ButtonBar merged gap="0">
          {['One', 'Two', 'Three'].map(id => (
            <Button key={id} {...makeMergedProps(id)}>
              {id}
            </Button>
          ))}
        </ButtonBar>

        <p>
          Managing the active state is optional, and you can also just use the buttonbar
          to manage the button layout.
        </p>
        <ButtonBar merged gap="0">
          {['One', 'Two', 'Three'].map(id => (
            <Button key={id}>{id}</Button>
          ))}
        </ButtonBar>

        <p>
          <Storybook.JSXNode name="ButtonBar" />s can have a single button in which case
          it looks like a button.
        </p>
        <ButtonBar gap="0">
          <Button>One Lonely Button</Button>
        </ButtonBar>
      </Fragment>
    );
  });
});
