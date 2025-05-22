import {Fragment} from 'react';

import Collapsible from 'sentry/components/collapsible';
import {Button} from 'sentry/components/core/button';
import * as Storybook from 'sentry/stories';

export default Storybook.story('Collapsible', story => {
  story('Default', () => (
    <Fragment>
      <p>
        After passing in a list of children, <Storybook.JSXNode name="Collapsible" /> will
        truncate the list to be a max of{' '}
        <Storybook.JSXProperty name="maxVisibleItems" value={Number} /> long.
      </p>
      <Storybook.SizingWindow display="block">
        <Collapsible maxVisibleItems={3}>
          <div>Item 1</div>
          <div>Item 2</div>
          <div>Item 3</div>
          <div>Item 4</div>
          <div>Item 5</div>
        </Collapsible>
      </Storybook.SizingWindow>
    </Fragment>
  ));

  story('Bugs', () => (
    <Fragment>
      <p>
        It's possible to use <Storybook.JSXNode name="ul" /> or{' '}
        <Storybook.JSXNode name="ol" />, but beware that the button will appear inside the
        list as well.
      </p>
      <Storybook.SideBySide>
        <ol>
          <Collapsible maxVisibleItems={2}>
            <li>Item 1</li>
            <li>Item 2</li>
            <li>Item 3</li>
          </Collapsible>
        </ol>
        <ul>
          <Collapsible maxVisibleItems={2}>
            <li>Item 1</li>
            <li>Item 2</li>
            <li>Item 3</li>
          </Collapsible>
        </ul>
      </Storybook.SideBySide>
    </Fragment>
  ));

  story('maxVisibleItems', () => {
    const allItems = ['one', 'two', 'three', 'four', 'five'].map(i => (
      <div key={i}>Item {i}</div>
    ));

    return (
      <Fragment>
        <p>
          <Storybook.JSXProperty name="maxVisibleItems" value={Number} /> will show/hide
          and pluralize the button label as needed.
        </p>
        <Storybook.SideBySide>
          {[3, 4, 5, 6].map(maxVisibleItems => (
            <div key={maxVisibleItems}>
              <p>
                <Storybook.JSXProperty name="maxVisibleItems" value={maxVisibleItems} />
              </p>
              <Storybook.SizingWindow display="block">
                <Collapsible maxVisibleItems={maxVisibleItems}>{allItems}</Collapsible>
              </Storybook.SizingWindow>
            </div>
          ))}
        </Storybook.SideBySide>
      </Fragment>
    );
  });

  story('Custom Buttons', () => (
    <Fragment>
      <p>
        You can set custom{' '}
        <Storybook.JSXProperty name="collapseButton" value={Function} /> &{' '}
        <Storybook.JSXProperty name="expandeButton" value={Function} />, and they will
        always be rendered in the same spot, at the bottom of the list.
      </p>
      <Collapsible
        maxVisibleItems={2}
        collapseButton={({onCollapse}) => (
          <Button size="xs" onClick={onCollapse}>
            Collapse
          </Button>
        )}
        expandButton={({numberOfHiddenItems, onExpand}) => (
          <Button size="xs" onClick={onExpand}>
            Expand ({numberOfHiddenItems} hidden)
          </Button>
        )}
      >
        <li>Item 1</li>
        <li>Item 2</li>
        <li>Item 3</li>
      </Collapsible>
    </Fragment>
  ));
});
