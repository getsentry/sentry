import {Fragment, useState} from 'react';
import range from 'lodash/range';

import * as Storybook from 'sentry/stories';

import type {TabListProps, TabsProps} from './tabs';
import {TabList, TabPanels, Tabs} from './tabs';

export default Storybook.story('Tabs', story => {
  const TABS = [
    {key: 'one', label: 'Label 1', content: 'This is the first Panel.'},
    {key: 'two', label: 'Label 2', content: 'This is the second panel'},
    {key: 'three', label: 'Label 3', content: 'This is the third panel'},
    {key: 'four', label: 'Label 4', content: 'This is the fourth panel', disabled: true},
  ];

  story('Default', () => (
    <Fragment>
      <p>
        You should be using all of <Storybook.JSXNode name="Tabs" />,{' '}
        <Storybook.JSXNode name="TabList" />, <Storybook.JSXNode name="TabList.Item" />,{' '}
        <Storybook.JSXNode name="TabPanels" /> and
        <Storybook.JSXNode name="TabPanels.Item" /> components.
      </p>
      <p>
        This will give you all kinds of accessibility and state tracking out of the box.
        But you will have to render all tab content, including hooks, upfront.
      </p>
      <Tabs>
        <TabList>
          {TABS.map(tab => (
            <TabList.Item disabled={tab.disabled} key={tab.key}>
              {tab.label}
            </TabList.Item>
          ))}
        </TabList>
        <TabPanels>
          {TABS.map(tab => (
            <TabPanels.Item key={tab.key}>{tab.content}</TabPanels.Item>
          ))}
        </TabPanels>
      </Tabs>
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
        <Storybook.SizingWindow display="block" style={{height: '210px', width: '400px'}}>
          <Tabs defaultValue="two">
            <TabList>
              {tabs.map(tab => (
                <TabList.Item key={tab.key}>{tab.label}</TabList.Item>
              ))}
            </TabList>
          </Tabs>
        </Storybook.SizingWindow>
      </Fragment>
    );
  });

  story('Default Value', () => (
    <Fragment>
      <p>
        Set <Storybook.JSXNode name="Tabs" props={{defaultValue: String}} />
      </p>
      <Storybook.SizingWindow>
        <Tabs defaultValue="two">
          <TabList>
            {TABS.map(tab => (
              <TabList.Item key={tab.key}>{tab.label}</TabList.Item>
            ))}
          </TabList>
          <TabPanels>
            {TABS.map(tab => (
              <TabPanels.Item key={tab.key}>{tab.content}</TabPanels.Item>
            ))}
          </TabPanels>
        </Tabs>
      </Storybook.SizingWindow>
    </Fragment>
  ));

  story('Controlled Value', () => {
    const [selected, setSelected] = useState('four');
    return (
      <Fragment>
        <p>
          If you want to control the state of the tabs from outside, you can call{' '}
          <var>{'useState()'}</var> and set{' '}
          <Storybook.JSXNode name="Tabs" props={{value: String, onChange: Function}} />{' '}
          manually.
        </p>
        <p>
          This is useful if you want to detect button clicks and do something different.{' '}
          The <Storybook.JSXNode name="Tabs" /> context wrapper is not required in this
          case.
        </p>
        <p>selected={selected}</p>
        <Storybook.SizingWindow>
          <Tabs value={selected} onChange={setSelected}>
            <TabList>
              {TABS.map(tab => (
                <TabList.Item key={tab.key} disabled={tab.disabled}>
                  {tab.label}
                </TabList.Item>
              ))}
            </TabList>
            <TabPanels>
              {TABS.map(tab => (
                <TabPanels.Item key={tab.key}>{tab.content}</TabPanels.Item>
              ))}
            </TabPanels>
          </Tabs>
        </Storybook.SizingWindow>
      </Fragment>
    );
  });

  story('Disabled', () => (
    <Storybook.SideBySide>
      <div>
        <p>
          Use <Storybook.JSXNode name="Tabs" props={{disabled: true}} /> to disable
          everything.
        </p>
        <Storybook.SizingWindow>
          <Tabs disabled>
            <TabList>
              {TABS.map(tab => (
                <TabList.Item key={tab.key}>{tab.label}</TabList.Item>
              ))}
            </TabList>
            <TabPanels>
              {TABS.map(tab => (
                <TabPanels.Item key={tab.key}>{tab.content}</TabPanels.Item>
              ))}
            </TabPanels>
          </Tabs>
        </Storybook.SizingWindow>
      </div>
      <div>
        <p>
          Use <Storybook.JSXNode name="TabList.Item" props={{disabled: true}} /> to
          disable individual <Storybook.JSXNode name="TabList.Item" /> children.
        </p>
        <Storybook.SizingWindow>
          <Tabs>
            <TabList>
              {TABS.map(tab => (
                <TabList.Item disabled={tab.key === 'three'} key={tab.key}>
                  {tab.label}
                </TabList.Item>
              ))}
            </TabList>
            <TabPanels>
              {TABS.map(tab => (
                <TabPanels.Item key={tab.key}>{tab.content}</TabPanels.Item>
              ))}
            </TabPanels>
          </Tabs>
        </Storybook.SizingWindow>
      </div>
    </Storybook.SideBySide>
  ));

  story('Variants', () => {
    const propMatrix: Storybook.PropMatrix<TabsProps<string> & TabListProps> = {
      orientation: ['horizontal', 'vertical'],
      variant: ['flat', 'floating'],
    };

    return (
      <div>
        <p>
          Use the variant prop to control which tab design to use. The default, "flat", is
          used in the above examples, but you can also use the "floating" variant, as
          shown below.
        </p>
        <Storybook.SizingWindow>
          <Tabs>
            <TabList variant="floating">
              {TABS.map(tab => (
                <TabList.Item key={tab.key}>{tab.label}</TabList.Item>
              ))}
            </TabList>
            <TabPanels>
              {TABS.map(tab => (
                <TabPanels.Item key={tab.key}>{tab.content}</TabPanels.Item>
              ))}
            </TabPanels>
          </Tabs>
        </Storybook.SizingWindow>
        <br />
        <Storybook.PropMatrix<TabsProps<string> & TabListProps>
          render={props => (
            <Tabs orientation={props.orientation}>
              <TabList variant={props.variant}>
                {TABS.map(tab => (
                  <TabList.Item key={tab.key}>{tab.label}</TabList.Item>
                ))}
              </TabList>
              <TabPanels>
                {TABS.map(tab => (
                  <TabPanels.Item key={tab.key}>{tab.content}</TabPanels.Item>
                ))}
              </TabPanels>
            </Tabs>
          )}
          propMatrix={propMatrix}
          selectedProps={['orientation', 'variant']}
        />
      </div>
    );
  });
});
