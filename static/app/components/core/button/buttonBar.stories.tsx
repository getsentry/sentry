import {Fragment, useState} from 'react';
import documentation from '!!type-loader!@sentry/scraps/button';

import {Button, ButtonBar, type ButtonProps} from '@sentry/scraps/button';
import {Grid} from '@sentry/scraps/layout';

import * as Storybook from 'sentry/stories';

export default Storybook.story('ButtonBar', (story, APIReference) => {
  APIReference(documentation.props?.ButtonBar);

  story('Default', () => {
    const [active, setActive] = useState('One');

    function makeProps(id: string): Partial<ButtonProps> {
      return {
        priority: active === id ? 'primary' : 'default',
        onClick: () => setActive(id),
      };
    }

    return (
      <Fragment>
        <p>
          A <Storybook.JSXNode name="ButtonBar" /> is a specialized component for creating
          merged button groups (pill bars). Buttons are visually joined together with
          shared borders and no gaps between them, creating a cohesive control unit.
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
        <ButtonBar>
          {['One', 'Two', 'Three'].map(id => (
            <Button key={id} {...makeProps(id)}>
              {id}
            </Button>
          ))}
        </ButtonBar>

        <p>
          Managing the active state is optional, and you can also just use the ButtonBar
          for layout without state management.
        </p>
        <ButtonBar>
          {['One', 'Two', 'Three'].map(id => (
            <Button key={id}>{id}</Button>
          ))}
        </ButtonBar>

        <p>
          <Storybook.JSXNode name="ButtonBar" />s can have a single button, in which case
          it looks like a regular button.
        </p>
        <ButtonBar>
          <Button>One Lonely Button</Button>
        </ButtonBar>

        <p>
          For button groups with spacing between buttons, use{' '}
          <Storybook.JSXNode name="Grid" /> instead with{' '}
          <Storybook.JSXProperty name="flow" value="column" /> and your desired gap:
        </p>
        <Grid flow="column" align="center" gap="md">
          <Button>Cancel</Button>
          <Button priority="primary">Save</Button>
        </Grid>
      </Fragment>
    );
  });
});
