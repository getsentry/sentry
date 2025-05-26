import {Fragment, useState} from 'react';

import {SegmentedControl} from 'sentry/components/core/segmentedControl';
import {IconStats} from 'sentry/icons';
import * as Storybook from 'sentry/stories';

export default Storybook.story('SegmentedControl', story => {
  story('Controlled Value', () => {
    const [value, setValue] = useState('two');
    const [value2, setValue2] = useState('one');
    return (
      <Fragment>
        <p>
          If you want to control the state of the tabs from outside, you can call{' '}
          <var>{'useState()'}</var> and set{' '}
          <Storybook.JSXNode
            name="SegmentedControl"
            props={{value: String, onChange: Function}}
          />{' '}
          manually.
        </p>
        <p>selected={value}</p>
        <Storybook.SideBySide>
          <SegmentedControl value={value} onChange={setValue} priority="default">
            <SegmentedControl.Item key="one">One</SegmentedControl.Item>
            <SegmentedControl.Item key="two">Two</SegmentedControl.Item>
            <SegmentedControl.Item key="three">Three</SegmentedControl.Item>
          </SegmentedControl>
          <SegmentedControl value={value} onChange={setValue} priority="primary">
            <SegmentedControl.Item key="one">One</SegmentedControl.Item>
            <SegmentedControl.Item key="two">Two</SegmentedControl.Item>
            <SegmentedControl.Item key="three">Three</SegmentedControl.Item>
          </SegmentedControl>
        </Storybook.SideBySide>

        <p>selected={value2}</p>
        <Storybook.SideBySide>
          <SegmentedControl value={value2} onChange={setValue2} priority="default">
            <SegmentedControl.Item key="one">One</SegmentedControl.Item>
            <SegmentedControl.Item key="two">Two</SegmentedControl.Item>
          </SegmentedControl>
          <SegmentedControl value={value2} onChange={setValue2} priority="primary">
            <SegmentedControl.Item key="one">One</SegmentedControl.Item>
            <SegmentedControl.Item key="two">Two</SegmentedControl.Item>
          </SegmentedControl>
        </Storybook.SideBySide>
      </Fragment>
    );
  });

  story('Props', () => (
    <Storybook.PropMatrix
      render={props => {
        const [value, setValue] = useState('two');
        return (
          <SegmentedControl {...props} value={value} onChange={setValue}>
            <SegmentedControl.Item key="one">One</SegmentedControl.Item>
            <SegmentedControl.Item key="two">Two</SegmentedControl.Item>
            <SegmentedControl.Item key="three">Three</SegmentedControl.Item>
          </SegmentedControl>
        );
      }}
      selectedProps={['priority', 'size']}
      propMatrix={{
        size: ['md' as const, 'sm' as const, 'xs' as const],
        priority: ['default' as const, 'primary' as const],
      }}
    />
  ));

  story('SegmentedControl.Item', () => (
    <Storybook.SideBySide>
      <Storybook.PropMatrix
        render={({showChild, ...props}) => {
          const [value, setValue] = useState('two');
          return (
            <SegmentedControl value={value} onChange={setValue}>
              <SegmentedControl.Item
                key="one"
                aria-label={showChild ? undefined : 'One'}
                {...props}
              >
                {showChild ? 'One' : undefined}
              </SegmentedControl.Item>
              <SegmentedControl.Item
                key="two"
                aria-label={showChild ? undefined : 'Two'}
                {...props}
              >
                {showChild ? 'Two' : undefined}
              </SegmentedControl.Item>
              <SegmentedControl.Item
                key="three"
                aria-label={showChild ? undefined : 'Three'}
                {...props}
              >
                {showChild ? 'Three' : undefined}
              </SegmentedControl.Item>
            </SegmentedControl>
          );
        }}
        selectedProps={['showChild', 'icon']}
        propMatrix={{
          showChild: [true, false],
          icon: [undefined, <IconStats key="play" />],
        }}
      />
      <Storybook.PropMatrix
        render={props => {
          const [value, setValue] = useState('two');
          return (
            <SegmentedControl value={value} onChange={setValue}>
              <SegmentedControl.Item key="one" {...props}>
                One
              </SegmentedControl.Item>
              <SegmentedControl.Item key="two" {...props}>
                Two
              </SegmentedControl.Item>
              <SegmentedControl.Item key="three" {...props}>
                Three
              </SegmentedControl.Item>
            </SegmentedControl>
          );
        }}
        selectedProps={['tooltip', 'disabled']}
        propMatrix={{
          tooltip: [undefined, 'Pick Me'],
          disabled: [false, true],
        }}
      />
      <Storybook.PropMatrix
        render={props => {
          const [value, setValue] = useState('two');
          return (
            <SegmentedControl priority={props.priority} value={value} onChange={setValue}>
              <SegmentedControl.Item key="one" disabled={props.disabled}>
                One
              </SegmentedControl.Item>
              <SegmentedControl.Item key="two" disabled={props.disabled}>
                Two
              </SegmentedControl.Item>
              <SegmentedControl.Item key="three" disabled={props.disabled}>
                Three
              </SegmentedControl.Item>
            </SegmentedControl>
          );
        }}
        selectedProps={['disabled', 'priority']}
        propMatrix={{
          disabled: [true, false],
          priority: ['default' as const, 'primary' as const],
        }}
      />
    </Storybook.SideBySide>
  ));
});
