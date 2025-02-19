import {Fragment} from 'react';

import {Button} from 'sentry/components/button';
import Collapsible from 'sentry/components/collapsible';
import JSXNode from 'sentry/components/stories/jsxNode';
import JSXProperty from 'sentry/components/stories/jsxProperty';
import SideBySide from 'sentry/components/stories/sideBySide';
import SizingWindow from 'sentry/components/stories/sizingWindow';
import storyBook from 'sentry/stories/storyBook';

export default storyBook('Collapsible', story => {
  story('Default', () => (
    <Fragment>
      <p>
        After passing in a list of children, <JSXNode name="Collapsible" /> will truncate
        the list to be a max of <JSXProperty name="maxVisibleItems" value={Number} />{' '}
        long.
      </p>
      <SizingWindow display="block">
        <Collapsible maxVisibleItems={3}>
          <div>Item 1</div>
          <div>Item 2</div>
          <div>Item 3</div>
          <div>Item 4</div>
          <div>Item 5</div>
        </Collapsible>
      </SizingWindow>
    </Fragment>
  ));

  story('Bugs', () => (
    <Fragment>
      <p>
        It's possible to use <JSXNode name="ul" /> or <JSXNode name="ol" />, but beware
        that the button will appear inside the list as well.
      </p>
      <SideBySide>
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
      </SideBySide>
    </Fragment>
  ));

  story('maxVisibleItems', () => {
    const allItems = ['one', 'two', 'three', 'four', 'five'].map(i => (
      <div key={i}>Item {i}</div>
    ));

    return (
      <Fragment>
        <p>
          <JSXProperty name="maxVisibleItems" value={Number} /> will show/hide and
          pluralize the button label as needed.
        </p>
        <SideBySide>
          {[3, 4, 5, 6].map(maxVisibleItems => (
            <div key={maxVisibleItems}>
              <p>
                <JSXProperty name="maxVisibleItems" value={maxVisibleItems} />
              </p>
              <SizingWindow display="block">
                <Collapsible maxVisibleItems={maxVisibleItems}>{allItems}</Collapsible>
              </SizingWindow>
            </div>
          ))}
        </SideBySide>
      </Fragment>
    );
  });

  story('Custom Buttons', () => (
    <Fragment>
      <p>
        You can set custom <JSXProperty name="collapseButton" value={Function} /> &{' '}
        <JSXProperty name="expandeButton" value={Function} />, and they will always be
        rendered in the same spot, at the bottom of the list.
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
