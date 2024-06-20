import {Fragment, useState} from 'react';
import range from 'lodash/range';

import JSXNode from 'sentry/components/stories/jsxNode';
import Matrix from 'sentry/components/stories/matrix';
import SideBySide from 'sentry/components/stories/sideBySide';
import SizingWindow from 'sentry/components/stories/sizingWindow';
import type {DroppableTabsProps} from 'sentry/components/tabs_dndTabs';
import {DroppableTabs} from 'sentry/components/tabs_dndTabs';
import type {DroppableTabListProps} from 'sentry/components/tabs_dndTabs/droppableTabList';
import {DroppableTabList} from 'sentry/components/tabs_dndTabs/droppableTabList';
import {DroppableTabPanels} from 'sentry/components/tabs_dndTabs/droppableTabPanels';
import storyBook from 'sentry/stories/storyBook';

export default storyBook(DroppableTabs, story => {
  const TABS = [
    {key: 'one', label: 'One', content: 'This is the first Panel.'},
    {key: 'two', label: 'Two', content: 'This is the second panel'},
    {key: 'three', label: 'Three', content: 'This is the third panel'},
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
        <DroppableTabs>
          <DroppableTabList>
            {TABS.map(tab => (
              <DroppableTabList.Item key={tab.key}>{tab.label}</DroppableTabList.Item>
            ))}
          </DroppableTabList>
          <DroppableTabPanels>
            {TABS.map(tab => (
              <DroppableTabPanels.Item key={tab.key}>
                {tab.content}
              </DroppableTabPanels.Item>
            ))}
          </DroppableTabPanels>
        </DroppableTabs>
      </SizingWindow>
    </Fragment>
  ));

  story('Items Overflow', () => {
    const tabs = range(65, 75).map(i => ({
      key: 'i' + i,
      label: String.fromCharCode(i, i, i, i),
      content: String.fromCharCode(i, i, i, i),
    }));
    return (
      <Fragment>
        <p>When there are many items, they will overflow into a dropdown menu.</p>
        <SizingWindow display="block" style={{height: '210px', width: '400px'}}>
          <DroppableTabs defaultValue="two">
            <DroppableTabList>
              {tabs.map(tab => (
                <DroppableTabList.Item key={tab.key}>{tab.label}</DroppableTabList.Item>
              ))}
            </DroppableTabList>
          </DroppableTabs>
        </SizingWindow>
      </Fragment>
    );
  });

  story('Default Value', () => (
    <Fragment>
      <p>
        Set <JSXNode name="Tabs" props={{defaultValue: String}} />
      </p>
      <SizingWindow>
        <DroppableTabs defaultValue="two">
          <DroppableTabList>
            {TABS.map(tab => (
              <DroppableTabList.Item key={tab.key}>{tab.label}</DroppableTabList.Item>
            ))}
          </DroppableTabList>
          <DroppableTabPanels>
            {TABS.map(tab => (
              <DroppableTabPanels.Item key={tab.key}>
                {tab.content}
              </DroppableTabPanels.Item>
            ))}
          </DroppableTabPanels>
        </DroppableTabs>
      </SizingWindow>
    </Fragment>
  ));

  story('Controlled Value', () => {
    const [selected, setSelected] = useState('two');
    return (
      <Fragment>
        <p>
          If you want to control the state of the tabs from outside, you can call{' '}
          <var>{'useState()'}</var> and set{' '}
          <JSXNode name="Tabs" props={{value: String, onChange: Function}} /> manually.
        </p>
        <p>
          This is useful if you want to detect button clicks and do something different.{' '}
          The <JSXNode name="Tabs" /> context wrapper is not required in this case.
        </p>
        <p>selected={selected}</p>
        <SizingWindow>
          <DroppableTabs value={selected} onChange={setSelected}>
            <DroppableTabList>
              {TABS.map(tab => (
                <DroppableTabList.Item key={tab.key}>{tab.label}</DroppableTabList.Item>
              ))}
            </DroppableTabList>
            <DroppableTabPanels>
              {TABS.map(tab => (
                <DroppableTabPanels.Item key={tab.key}>
                  {tab.content}
                </DroppableTabPanels.Item>
              ))}
            </DroppableTabPanels>
          </DroppableTabs>
        </SizingWindow>
      </Fragment>
    );
  });

  story('Rendering', () => (
    <Matrix<DroppableTabsProps<string> & DroppableTabListProps>
      render={props => (
        <DroppableTabs orientation={props.orientation}>
          <DroppableTabList hideBorder={props.hideBorder}>
            {TABS.map(tab => (
              <DroppableTabList.Item key={tab.key}>{tab.label}</DroppableTabList.Item>
            ))}
          </DroppableTabList>
          <DroppableTabPanels>
            {TABS.map(tab => (
              <DroppableTabPanels.Item key={tab.key}>
                {tab.content}
              </DroppableTabPanels.Item>
            ))}
          </DroppableTabPanels>
        </DroppableTabs>
      )}
      propMatrix={{
        orientation: ['horizontal', 'vertical'],
        hideBorder: [false, true],
      }}
      selectedProps={['orientation', 'hideBorder']}
    />
  ));

  story('Disabled', () => (
    <SideBySide>
      <div>
        <p>
          Use <JSXNode name="Tabs" props={{disabled: true}} /> to disable everything.
        </p>
        <SizingWindow>
          <DroppableTabs disabled>
            <DroppableTabList>
              {TABS.map(tab => (
                <DroppableTabList.Item key={tab.key}>{tab.label}</DroppableTabList.Item>
              ))}
            </DroppableTabList>
            <DroppableTabPanels>
              {TABS.map(tab => (
                <DroppableTabPanels.Item key={tab.key}>
                  {tab.content}
                </DroppableTabPanels.Item>
              ))}
            </DroppableTabPanels>
          </DroppableTabs>
        </SizingWindow>
      </div>
      <div>
        <p>
          Use <JSXNode name="TabList" props={{disabledKeys: Array}} /> to disable
          individual <JSXNode name="TabList.Item" /> children.
        </p>
        <SizingWindow>
          <DroppableTabs>
            <DroppableTabList disabledKeys={['two']}>
              {TABS.map(tab => (
                <DroppableTabList.Item key={tab.key}>{tab.label}</DroppableTabList.Item>
              ))}
            </DroppableTabList>
            <DroppableTabPanels>
              {TABS.map(tab => (
                <DroppableTabPanels.Item key={tab.key}>
                  {tab.content}
                </DroppableTabPanels.Item>
              ))}
            </DroppableTabPanels>
          </DroppableTabs>
        </SizingWindow>
      </div>
    </SideBySide>
  ));
});
