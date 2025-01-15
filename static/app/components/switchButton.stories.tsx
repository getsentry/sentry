import type {ComponentProps} from 'react';
import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import JSXNode from 'sentry/components/stories/jsxNode';
import JSXProperty from 'sentry/components/stories/jsxProperty';
import type {PropMatrix} from 'sentry/components/stories/matrix';
import Matrix from 'sentry/components/stories/matrix';
import Switch from 'sentry/components/switchButton';
import storyBook from 'sentry/stories/storyBook';
import {space} from 'sentry/styles/space';

export default storyBook('Switch', story => {
  story('Basics', () => {
    const [toggleOn, setToggleOn] = useState(false);
    return (
      <Fragment>
        <p>
          The <JSXNode name="Switch" /> component is a toggle button. It doesn&apos;t have
          any property to specify a text label, so you&apos;ll need to add your own
          accompanying label if you need one.
        </p>
        <p>
          Here we are specifying the label with an HTML <code>label</code> element, which
          is also accessibility friendly -- clicking the label also affects the toggle!
        </p>
        <SwitchItem htmlFor="switch">
          {toggleOn ? 'Switch is on' : 'Switch is off'}
          <Switch id="switch" toggle={() => setToggleOn(!toggleOn)} isActive={toggleOn} />
        </SwitchItem>
        <p>
          You can pass a callback function into the <JSXProperty name="toggle" value />{' '}
          prop to control what happens when the toggle is clicked. Pair this with a{' '}
          <code>useState</code> or some other code to set the active state of the toggle,
          which is controlled by the prop <JSXProperty name="isActive" value />.
        </p>
      </Fragment>
    );
  });

  story('size', () => {
    const [toggleOnL, setToggleOnL] = useState(false);
    const [toggleOnS, setToggleOnS] = useState(false);
    return (
      <Fragment>
        <p>
          The prop has two options: <JSXProperty name="size" value="sm" />
          and <JSXProperty name="size" value="lg" />. The default value is{' '}
          <JSXProperty name="size" value="sm" />.
        </p>
        <SwitchItem htmlFor="lg-switch">
          Large switch
          <Switch
            id="lg-switch"
            toggle={() => setToggleOnL(!toggleOnL)}
            size="lg"
            isActive={toggleOnL}
          />
        </SwitchItem>
        <SwitchItem htmlFor="sm-switch">
          Small switch
          <Switch
            id="sm-switch"
            toggle={() => setToggleOnS(!toggleOnS)}
            size="sm"
            isActive={toggleOnS}
          />
        </SwitchItem>
      </Fragment>
    );
  });

  story('Other props', () => {
    const propMatrix: PropMatrix<ComponentProps<typeof Switch>> = {
      forceActiveColor: [true, false],
      isDisabled: [true, false],
    };

    const [toggleOn, setToggleOn] = useState(false);
    const [toggleOnTwo, setToggleOnTwo] = useState(false);

    return (
      <Fragment>
        <p>
          The <JSXProperty name="forceActiveColor" value />
          and <JSXProperty name="isDisabled" value /> props can be used to force a single
          state.
        </p>
        <Matrix
          render={props => (
            <Switch
              {...props}
              toggle={
                !props.isDisabled
                  ? !props.forceActiveColor
                    ? () => setToggleOn(!toggleOn)
                    : () => setToggleOnTwo(!toggleOnTwo)
                  : () => {}
              }
              isActive={
                !props.isDisabled
                  ? !props.forceActiveColor
                    ? toggleOn
                    : toggleOnTwo
                  : false
              }
            />
          )}
          propMatrix={propMatrix}
          selectedProps={['forceActiveColor', 'isDisabled']}
        />
      </Fragment>
    );
  });
});

const SwitchItem = styled('label')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;
