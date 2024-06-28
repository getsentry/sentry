import {Fragment} from 'react';

import {DraggableTabBar} from 'sentry/components/draggableTabs';
import JSXNode from 'sentry/components/stories/jsxNode';
import SizingWindow from 'sentry/components/stories/sizingWindow';
import storyBook from 'sentry/stories/storyBook';

export default storyBook(DraggableTabBar, story => {
  const TABS = [
    {key: 'one', label: 'Tab One', content: 'This is the first Panel.'},
    {key: 'two', label: 'Tab Two', content: 'This is the second panel'},
    {key: 'three', label: 'Tab Three', content: 'This is the third panel'},
  ];

  story('Default', () => (
    <Fragment>
      <p>
        You should be using all of <JSXNode name="Tabs" />, <JSXNode name="TabList" />,{' '}
        <JSXNode name="TabList.Item" />, <JSXNode name="DroppableTabPanels" /> and
        <JSXNode name="DroppableTabPanels.Item" /> components.
      </p>
      <p>
        This will give you all kinds of accessibility and state tracking out of the box.
        But you will have to render all tab content, including hooks, upfront.
      </p>
      <SizingWindow>
        <DraggableTabBar tabs={TABS} />
      </SizingWindow>
    </Fragment>
  ));
});
