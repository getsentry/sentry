import {Fragment, useState} from 'react';
import range from 'lodash/range';

import JSXNode from 'sentry/components/stories/jsxNode';
import Matrix, {type PropMatrix} from 'sentry/components/stories/matrix';
import SideBySide from 'sentry/components/stories/sideBySide';
import SizingWindow from 'sentry/components/stories/sizingWindow';
import type {TabListProps, TabsProps} from 'sentry/components/tabs';
import {TabList, TabPanels, Tabs} from 'sentry/components/tabs';
import storyBook from 'sentry/stories/storyBook';

export default storyBook('Tabs', story => {
  const TABS = [
    {key: 'one', label: 'One', content: 'This is the first Panel.'},
    {key: 'two', label: 'Two', content: 'This is the second panel'},
    {key: 'three', label: 'Three', content: 'This is the third panel'},
  ];

  story('Default', () => (
    <Fragment>
      <p>
        You should be using all of <JSXNode name="Tabs" />, <JSXNode name="TabList" />,{' '}
        <JSXNode name="TabList.Item" />, <JSXNode name="TabPanels" /> and
        <JSXNode name="TabPanels.Item" /> components.
      </p>
      <p>
        This will give you all kinds of accessibility and state tracking out of the box.
        But you will have to render all tab content, including hooks, upfront.
      </p>
      <SizingWindow>
        <Tabs>
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
          <Tabs defaultValue="two">
            <TabList>
              {tabs.map(tab => (
                <TabList.Item key={tab.key}>{tab.label}</TabList.Item>
              ))}
            </TabList>
          </Tabs>
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
          <Tabs value={selected} onChange={setSelected}>
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
        </SizingWindow>
      </Fragment>
    );
  });

  story('Rendering', () => (
    <Matrix<TabsProps<string> & TabListProps>
      render={props => (
        <Tabs orientation={props.orientation}>
          <TabList hideBorder={props.hideBorder}>
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
        </SizingWindow>
      </div>
      <div>
        <p>
          Use <JSXNode name="TabList" props={{disabledKeys: Array}} /> to disable
          individual <JSXNode name="TabList.Item" /> children.
        </p>
        <SizingWindow>
          <Tabs>
            <TabList disabledKeys={['two']}>
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
        </SizingWindow>
      </div>
    </SideBySide>
  ));

  story('Variants', () => {
    const propMatrix: PropMatrix<TabsProps<string> & TabListProps> = {
      hideBorder: [undefined, false, true],
      orientation: [undefined, 'horizontal', 'vertical'],
      variant: [undefined, 'flat', 'filled', 'floating'],
    };
    return (
      <div>
        <p>
          Use the variant prop to control which tab design to use. The default, "flat", is
          used in the above examples, but you can also use "filled" variant, as shown
          below. Note that the "filled" variant does not work when the oritentation is
          vertical
        </p>
        <SizingWindow>
          <Tabs>
            <TabList variant={'filled'}>
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
        </SizingWindow>
        <br />
        <p>You can also use the "floating" variant, which is used below</p>
        <SizingWindow>
          <Tabs>
            <TabList variant="floating" hideBorder>
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
        </SizingWindow>
        <br />
        <Matrix<TabsProps<string> & TabListProps>
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
        <br />
        <Matrix<TabsProps<string> & TabListProps>
          render={props => (
            <Tabs>
              <TabList variant={props.variant} hideBorder={props.hideBorder}>
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
          selectedProps={['hideBorder', 'variant']}
        />
      </div>
    );
  });
});
