import {Fragment, useState} from 'react';

import {SegmentedControl} from 'sentry/components/segmentedControl';
import JSXNode from 'sentry/components/stories/jsxNode';
import Matrix from 'sentry/components/stories/matrix';
import SideBySide from 'sentry/components/stories/sideBySide';
import {IconStats} from 'sentry/icons';
import storyBook from 'sentry/stories/storyBook';

export default storyBook('SegmentedControl', story => {
  story('Default', () => (
    <Fragment>
      <p>
        By default <JSXNode name="SegmentedControl" /> will keep track of what is
        selected.
      </p>
      <SegmentedControl>
        <SegmentedControl.Item key="one">One</SegmentedControl.Item>
        <SegmentedControl.Item key="two">Two</SegmentedControl.Item>
        <SegmentedControl.Item key="three">Three</SegmentedControl.Item>
      </SegmentedControl>
    </Fragment>
  ));

  story('Controlled Value', () => {
    const [value, setValue] = useState('two');
    return (
      <Fragment>
        <p>
          If you want to control the state of the tabs from outside, you can call{' '}
          <var>{'useState()'}</var> and set{' '}
          <JSXNode name="SegmentedControl" props={{value: String, onChange: Function}} />{' '}
          manually.
        </p>
        <p>selected={value}</p>
        <SegmentedControl value={value} onChange={setValue}>
          <SegmentedControl.Item key="one">One</SegmentedControl.Item>
          <SegmentedControl.Item key="two">Two</SegmentedControl.Item>
          <SegmentedControl.Item key="three">Three</SegmentedControl.Item>
        </SegmentedControl>
      </Fragment>
    );
  });

  story('Props', () => (
    <Matrix
      render={props => (
        <SegmentedControl {...props}>
          <SegmentedControl.Item key="one">One</SegmentedControl.Item>
          <SegmentedControl.Item key="two">Two</SegmentedControl.Item>
          <SegmentedControl.Item key="three">Three</SegmentedControl.Item>
        </SegmentedControl>
      )}
      selectedProps={['priority', 'size']}
      propMatrix={{
        size: ['md' as const, 'sm' as const, 'xs' as const],
        priority: ['default' as const, 'primary' as const],
      }}
    />
  ));

  story('SegmentedControl.Item', () => (
    <SideBySide>
      <Matrix
        render={({showChild, ...props}) => (
          <SegmentedControl>
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
        )}
        selectedProps={['showChild', 'icon']}
        propMatrix={{
          showChild: [true, false],
          icon: [undefined, <IconStats key="play" />],
        }}
      />
      <Matrix
        render={props => (
          <SegmentedControl>
            <SegmentedControl.Item key="one" tooltip="One">
              One
            </SegmentedControl.Item>
            <SegmentedControl.Item key="two" {...props}>
              Two
            </SegmentedControl.Item>
            <SegmentedControl.Item key="three" tooltip="Three">
              Three
            </SegmentedControl.Item>
          </SegmentedControl>
        )}
        selectedProps={['tooltip', 'disabled']}
        propMatrix={{
          tooltip: [undefined, 'Pick Me'],
          disabled: [false, true],
        }}
      />
      <Matrix
        render={props => (
          <SegmentedControl priority={props.priority}>
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
        )}
        selectedProps={['disabled', 'priority']}
        propMatrix={{
          disabled: [true, false],
          priority: ['default' as const, 'primary' as const],
        }}
      />
    </SideBySide>
  ));
});
